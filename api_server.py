"""
Room3D Viewer -- API Server
============================

Architecture:
  - Pipelines are loaded ON DEMAND per request and unloaded after, so a single
    4 GB GPU can run both shape and texture work (just not simultaneously).
  - Shape pipeline is Hunyuan3D-DiT (a diffusers-style pipeline -- .to() works).
  - Texture pipeline is Hunyuan3D-Paint, which is NOT a diffusers Pipeline.
    It owns sub-models (delight, multiview, image encoder, rasterizer); it
    has NO .to() or .half() method. Calling either crashes at load time
    with: "'Hunyuan3DPaintPipeline' object has no attribute 'to'".
    The pipeline manages its own devices internally; we just call
    enable_model_cpu_offload() when available for low-VRAM GPUs.
  - 4 GB is well below Hunyuan's official 16 GB minimum for texture, so a
    runtime OOM is realistic. If the Hunyuan call fails (OOM, timeout, etc),
    we fall back to a trimesh spherical-UV bake of the reference image --
    lower quality but always works.

The known-OK diffusers warning about UNet module path
("Expected types for unet: UNet2p5DConditionModel from ...local.unet.modules,
got ...local.modules") is filtered at startup.
"""

import os, io, gc, base64, logging, tempfile, threading, time, warnings
import concurrent.futures
import numpy as np
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from PIL import Image

warnings.filterwarnings("ignore", message=r".*Expected types for unet.*")

load_dotenv()

# ----------------------------------------------------------------- config ---
LOW_VRAM   = os.getenv("LOW_VRAM_MODE", "true").lower() == "true"
USE_FP16   = os.getenv("USE_FP16", "true").lower() == "true"
FLASK_PORT = int(os.getenv("FLASK_PORT", "8080"))
FLASK_HOST = os.getenv("FLASK_HOST", "0.0.0.0")
SHAPE_REPO = os.getenv("SHAPE_REPO_ID", "tencent/Hunyuan3D-2mini")
SHAPE_SUB  = os.getenv("SHAPE_MODEL_SUBFOLDER", "hunyuan3d-dit-v2-mini")
TEX_REPO   = os.getenv("TEXTURE_REPO_ID", "tencent/Hunyuan3D-2")
# Default to the TURBO paint subfolder (fewer diffusion steps -> friendlier
# to 4 GB GPUs). Set TEXTURE_MODEL_SUBFOLDER=hunyuan3d-paint-v2-0 to use the
# higher-quality non-turbo model.
TEX_SUB    = os.getenv("TEXTURE_MODEL_SUBFOLDER", "hunyuan3d-paint-v2-0-turbo")
SIMPLIFY_VERTS  = int(os.getenv("SIMPLIFY_MAX_VERTS", "20000"))
TEX_REF_MAX_DIM = int(os.getenv("TEX_REF_MAX_DIM", "512"))
TEX_TIMEOUT_S   = int(os.getenv("TEX_TIMEOUT_S", "900"))   # 15 min

logging.basicConfig(
    level=logging.INFO,
    format="[room3d] %(asctime)s %(levelname)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("room3d")

generation_lock = threading.Lock()
rembg_session   = None
device          = None
dtype           = None
texture_mode    = "hunyuan"   # informational only


# ----------------------------------------------------------------- helpers ---
def detect_device():
    global device, dtype
    import torch
    if torch.cuda.is_available():
        device = "cuda:0"
        dtype  = torch.float16 if USE_FP16 else torch.float32
        vram   = torch.cuda.get_device_properties(0).total_memory / (1024**3)
        log.info(f"CUDA: {torch.cuda.get_device_name(0)} ({vram:.1f} GB)")
    else:
        import torch as _t
        device = "cpu"
        dtype  = _t.float32
        log.warning("No CUDA -- CPU mode")


def load_rembg():
    global rembg_session
    try:
        import rembg
        rembg_session = rembg.new_session("u2net")
        log.info("rembg loaded (u2net)")
    except Exception as e:
        log.warning(f"rembg unavailable: {e}")
        rembg_session = None


def remove_background(image: Image.Image) -> Image.Image:
    if rembg_session is None:
        return image.convert("RGB")
    import rembg
    rgba = rembg.remove(image, session=rembg_session)
    bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    bg.paste(rgba, mask=rgba.split()[3])
    return bg.convert("RGB")


def cleanup_vram():
    import torch
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()
    gc.collect()


def decode_image(data: str) -> Image.Image:
    if "," in data:
        data = data.split(",", 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(data))).convert("RGB")


# ----------------------------------------------------------------- pipelines ---
def get_shape_pipeline():
    """Load shape pipeline fresh onto GPU. Caller MUST unload it after use."""
    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
    log.info("Loading shape pipeline onto GPU...")
    pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
        SHAPE_REPO, subfolder=SHAPE_SUB
    )
    # Hunyuan3DDiTFlowMatchingPipeline IS a diffusers-style pipeline, so
    # .to(device) works for it. (Unlike Hunyuan3DPaintPipeline -- see below.)
    pipeline.to(device)
    return pipeline


def get_texture_pipeline():
    """
    Load texture pipeline. Caller MUST unload it after use.

    IMPORTANT: Hunyuan3DPaintPipeline is NOT a diffusers Pipeline subclass.
    It has NO .to() and NO .half() methods -- calling either raises
    `AttributeError: 'Hunyuan3DPaintPipeline' object has no attribute 'to'`.
    The pipeline owns several sub-models (delight, multiview, image encoder,
    rasterizer) and moves them to device on demand. Don't touch device on
    the parent; either let it manage itself, or call enable_model_cpu_offload
    when available for low-VRAM GPUs.
    """
    from hy3dgen.texgen import Hunyuan3DPaintPipeline
    log.info(f"Loading texture pipeline ({TEX_REPO}/{TEX_SUB})...")
    pipeline = Hunyuan3DPaintPipeline.from_pretrained(
        TEX_REPO, subfolder=TEX_SUB
    )

    if LOW_VRAM and hasattr(pipeline, "enable_model_cpu_offload"):
        try:
            pipeline.enable_model_cpu_offload()
            log.info("Texture pipeline: CPU offload enabled (low-VRAM mode)")
        except Exception as e:
            log.warning(f"enable_model_cpu_offload failed (continuing without): {e}")

    log.info("Texture pipeline loaded")
    return pipeline


def unload_pipeline(pipeline):
    """Best-effort: move to CPU (if supported) and free VRAM."""
    if pipeline is None:
        return
    try:
        if hasattr(pipeline, "to"):
            pipeline.to("cpu")
    except Exception:
        pass   # Hunyuan3DPaintPipeline has no .to(), that's fine
    try:
        del pipeline
    except Exception:
        pass
    cleanup_vram()
    log.info("Pipeline unloaded, VRAM freed.")


# ----------------------------------------------------------------- fallback ---
def fallback_texture_bake(glb_bytes: bytes, image: Image.Image) -> bytes:
    """
    Spherical-UV-projection bake of `image` onto the mesh. Lower quality than
    Hunyuan3D-Paint but works with zero CUDA and ~5s wall-time. Used when
    Hunyuan times out, OOMs, or otherwise fails -- 4 GB GPUs are below
    Hunyuan's official 16 GB minimum, so OOMs are expected.
    """
    import trimesh
    from trimesh.visual.material import PBRMaterial

    tmp_in_path = None
    tmp_out_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as tmp_in:
            tmp_in.write(glb_bytes)
            tmp_in_path = tmp_in.name

        loaded = trimesh.load(tmp_in_path, force="scene")
        meshes = (
            list(loaded.geometry.values())
            if hasattr(loaded, "geometry") and loaded.geometry
            else [loaded]
        )
        if not meshes:
            log.warning("Fallback texture: no mesh in GLB, returning untextured")
            return glb_bytes

        mesh = meshes[0]
        verts = np.asarray(mesh.vertices)
        if verts.size == 0:
            return glb_bytes

        center   = verts.mean(axis=0)
        centered = verts - center
        norms    = np.linalg.norm(centered, axis=1)
        r_max    = norms.max() if norms.max() > 0 else 1.0
        normed   = centered / r_max

        u = (np.arctan2(normed[:, 2], normed[:, 0]) / (2.0 * np.pi)) + 0.5
        v = 1.0 - ((np.arcsin(np.clip(normed[:, 1], -1, 1)) / np.pi) + 0.5)
        uvs = np.column_stack([u, v]).astype(np.float32)

        tex_img = image.convert("RGB").resize((1024, 1024), Image.LANCZOS)
        material = PBRMaterial(
            name="fallback_texture",
            baseColorTexture=tex_img,
            metallicFactor=0.0,
            roughnessFactor=0.85,
        )
        mesh.visual = trimesh.visual.TextureVisuals(uv=uvs, material=material)

        with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as tmp_out:
            tmp_out_path = tmp_out.name
        mesh.export(tmp_out_path)

        with open(tmp_out_path, "rb") as f:
            return f.read()
    finally:
        for p in (tmp_in_path, tmp_out_path):
            if p and os.path.exists(p):
                try: os.unlink(p)
                except OSError: pass


# ----------------------------------------------------------------- app ---
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})


@app.route("/health")
def health():
    import torch
    return jsonify({
        "status": "ok",
        "cuda": torch.cuda.is_available(),
        "device": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu",
        "shape_loaded": True,
        "texture_loaded": True,
        "texture_mode": texture_mode,
        "rembg_loaded": rembg_session is not None,
    })


@app.route("/texture-info")
def texture_info():
    return jsonify({
        "mode": texture_mode,
        "repo": f"{TEX_REPO}/{TEX_SUB}",
        "low_vram": LOW_VRAM,
        "fp16": USE_FP16,
        "simplify_max_verts": SIMPLIFY_VERTS,
        "ref_max_dim": TEX_REF_MAX_DIM,
        "timeout_s": TEX_TIMEOUT_S,
    })


@app.route("/generate", methods=["POST"])
def generate():
    import torch
    data = request.get_json()
    if not data or "image" not in data:
        return jsonify({"error": "Missing image"}), 400

    steps    = int(data.get("steps", 30))
    guidance = float(data.get("guidance", 7.5))
    seed     = int(data.get("seed", -1))

    if not generation_lock.acquire(timeout=2):
        return jsonify({"error": "Busy"}), 429

    shape_pipeline = None
    try:
        log.info(f"Generating shape (steps={steps}, guidance={guidance})")
        image = decode_image(data["image"])
        image = remove_background(image)
        log.info("Background removed, starting generation...")

        shape_pipeline = get_shape_pipeline()

        with torch.inference_mode():
            gen = torch.Generator(device=device).manual_seed(seed) if seed >= 0 else None
            mesh = shape_pipeline(
                image=image,
                num_inference_steps=steps,
                guidance_scale=guidance,
                dual_guidance=False,
                octree_resolution=256,
                generator=gen,
            )[0]
            tmp = tempfile.NamedTemporaryFile(suffix=".glb", delete=False)
            tmp.close()
            mesh.export(tmp.name)
            with open(tmp.name, "rb") as f:
                glb_bytes = f.read()
            os.unlink(tmp.name)

        log.info(f"Shape generated: {len(glb_bytes):,} bytes")
        return send_file(io.BytesIO(glb_bytes), mimetype="model/gltf-binary",
                         download_name="generated.glb")

    except Exception as e:
        log.error(f"Generation failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500
    finally:
        if shape_pipeline is not None:
            unload_pipeline(shape_pipeline)
        cleanup_vram()
        generation_lock.release()


def _safe_simplify(mesh_obj, target_verts):
    """
    Reduce mesh complexity for VRAM-friendly texturing. trimesh's
    `simplify_quadric_decimation` wraps either `fast_simplification` or
    `open3d`, and the two libraries take different arguments. Newer trimesh
    versions accept `percent=`, older ones accept positional `face_count`,
    and direct fast_simplification takes `target_reduction=` (a fraction).

    Tries each in order and falls through to the original mesh if all fail.
    """
    n_verts = len(mesh_obj.vertices)
    if n_verts <= target_verts:
        return mesh_obj

    log.info(f"Simplifying mesh from {n_verts} to {target_verts} verts (VRAM saver)")
    target_ratio = max(0.05, min(0.95, 1.0 - target_verts / max(1, n_verts)))
    target_face_count = max(8, int(target_verts * 2))

    # 1. Newer trimesh API: simplify_quadric_decimation(percent=...)
    try:
        out = mesh_obj.simplify_quadric_decimation(percent=target_ratio)
        if out is not None and hasattr(out, "vertices"):
            log.info(f"  via trimesh(percent={target_ratio:.3f})")
            return out
    except (TypeError, ValueError) as e:
        log.debug(f"  trimesh(percent=) unavailable: {e}")
    except Exception as e:
        log.debug(f"  trimesh(percent=) failed: {e}")

    # 2. Older trimesh API: simplify_quadric_decimation(face_count=...)
    try:
        out = mesh_obj.simplify_quadric_decimation(face_count=target_face_count)
        if out is not None and hasattr(out, "vertices"):
            log.info(f"  via trimesh(face_count={target_face_count})")
            return out
    except (TypeError, ValueError) as e:
        log.debug(f"  trimesh(face_count=) unavailable: {e}")
    except Exception as e:
        log.debug(f"  trimesh(face_count=) failed: {e}")

    # 3. Direct fast_simplification.simplify(verts, faces, target_reduction=...)
    try:
        import fast_simplification
        import trimesh as _tm
        verts = np.asarray(mesh_obj.vertices, dtype=np.float32)
        faces = np.asarray(mesh_obj.faces,    dtype=np.int32)
        new_verts, new_faces = fast_simplification.simplify(
            verts, faces, target_reduction=target_ratio
        )
        out = _tm.Trimesh(vertices=new_verts, faces=new_faces, process=False)
        log.info(f"  via fast_simplification(target_reduction={target_ratio:.3f})")
        return out
    except ImportError:
        log.warning(
            f"Mesh simplification unavailable -- install fast_simplification:  "
            f"pip install fast_simplification"
        )
    except Exception as e:
        log.warning(f"fast_simplification direct call failed ({type(e).__name__}: {e})")

    log.warning(
        f"Could not simplify; passing full mesh ({n_verts} verts) to Hunyuan. "
        f"Texture pipeline may OOM or time out on low-VRAM GPUs."
    )
    return mesh_obj


@app.route("/texture", methods=["POST"])
def texture():
    import torch
    import trimesh

    data = request.get_json()
    if not data or "glb" not in data:
        return jsonify({"error": "Missing glb"}), 400

    if not generation_lock.acquire(timeout=2):
        return jsonify({"error": "Busy"}), 429

    texture_pipeline = None
    used_mode = "hunyuan"
    out_bytes = None
    try:
        # ----- Decode inputs -----
        glb_b64 = data["glb"]
        if "," in glb_b64:
            glb_b64 = glb_b64.split(",", 1)[1]
        glb_bytes = base64.b64decode(glb_b64)

        ref = decode_image(data["image"]) if data.get("image") else None
        if ref is not None:
            ref = remove_background(ref)
            ref.thumbnail((TEX_REF_MAX_DIM, TEX_REF_MAX_DIM), Image.LANCZOS)

        # Frontend can request the fast UV bake explicitly (handy during dev or
        # when the user has already waited too long for a Hunyuan run).
        force_fallback = bool(data.get("force_fallback", False))

        if force_fallback:
            log.info("force_fallback=True; skipping Hunyuan, going straight to UV bake")
            if ref is not None:
                out_bytes = fallback_texture_bake(glb_bytes, ref)
                used_mode = "fallback (forced)"
            else:
                out_bytes = glb_bytes
                used_mode = "untextured (no ref)"
        else:
            # ----- Try Hunyuan -----
            try:
                texture_pipeline = get_texture_pipeline()
                log.info("Texturing with Hunyuan3D-Paint...")

                tmp_in_path = None
                tmp_out_path = None
                try:
                    with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as tin:
                        tin.write(glb_bytes)
                        tmp_in_path = tin.name

                    loaded = trimesh.load(tmp_in_path, force="scene")
                    if hasattr(loaded, "geometry") and loaded.geometry:
                        mesh_obj = list(loaded.geometry.values())[0]
                    else:
                        mesh_obj = loaded

                    if len(mesh_obj.vertices) > SIMPLIFY_VERTS:
                        mesh_obj = _safe_simplify(mesh_obj, SIMPLIFY_VERTS)
                    log.info(f"Mesh: {len(mesh_obj.vertices)} verts, {len(mesh_obj.faces)} faces")

                    with torch.inference_mode():
                        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
                            fut = ex.submit(texture_pipeline, mesh_obj, ref)
                            try:
                                result = fut.result(timeout=TEX_TIMEOUT_S)
                            except concurrent.futures.TimeoutError:
                                raise RuntimeError(f"Texture timed out after {TEX_TIMEOUT_S}s")
                            textured_mesh = result[0] if isinstance(result, (list, tuple)) else result

                    with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as tout:
                        tmp_out_path = tout.name
                    textured_mesh.export(tmp_out_path)
                    with open(tmp_out_path, "rb") as f:
                        out_bytes = f.read()
                    log.info(f"Hunyuan texturing succeeded: {len(out_bytes):,} bytes")
                finally:
                    for p in (tmp_in_path, tmp_out_path):
                        if p and os.path.exists(p):
                            try: os.unlink(p)
                            except OSError: pass

            except Exception as e:
                # OOM, timeout, attribute errors, anything -> fall back
                log.warning(
                    f"Hunyuan texturing failed ({type(e).__name__}: {e}); "
                    f"falling back to UV-projection bake"
                )
                if texture_pipeline is not None:
                    try: unload_pipeline(texture_pipeline)
                    except Exception: pass
                    texture_pipeline = None
                cleanup_vram()

                if ref is not None:
                    try:
                        out_bytes = fallback_texture_bake(glb_bytes, ref)
                        used_mode = "fallback (runtime)"
                    except Exception as fe:
                        log.error(f"Fallback bake also failed: {fe}")
                        out_bytes = glb_bytes
                        used_mode = "untextured (both failed)"
                else:
                    log.warning("No reference image; returning untextured GLB")
                    out_bytes = glb_bytes
                    used_mode = "untextured (no ref)"

        cleanup_vram()
        log.info(f"Texture done: {len(out_bytes):,} bytes (mode={used_mode})")
        resp = send_file(io.BytesIO(out_bytes), mimetype="model/gltf-binary",
                         download_name="textured.glb")
        resp.headers["X-Texture-Mode"] = used_mode
        return resp

    except Exception as e:
        log.error(f"Texture failed: {e}", exc_info=True)
        cleanup_vram()
        return jsonify({"error": str(e)}), 500
    finally:
        if texture_pipeline is not None:
            try: unload_pipeline(texture_pipeline)
            except Exception: pass
        cleanup_vram()
        generation_lock.release()


def main():
    log.info("=" * 60)
    log.info("  Room3D API Server")
    log.info(f"  Shape  : {SHAPE_REPO} / {SHAPE_SUB}")
    log.info(f"  Texture: {TEX_REPO} / {TEX_SUB}")
    log.info(f"  Low VRAM: {LOW_VRAM}  FP16: {USE_FP16}  Port: {FLASK_PORT}")
    log.info(f"  Mesh simplify @ {SIMPLIFY_VERTS} verts, "
             f"texture ref capped @ {TEX_REF_MAX_DIM}px, "
             f"texture timeout {TEX_TIMEOUT_S}s")
    log.info("  Pipelines load on demand and unload after each request.")
    log.info("=" * 60)
    detect_device()
    load_rembg()
    log.info("=" * 60)
    log.info(f"  Server ready on http://localhost:{FLASK_PORT}")
    log.info("=" * 60)
    app.run(host=FLASK_HOST, port=FLASK_PORT, debug=False, threaded=True)


if __name__ == "__main__":
    main()
