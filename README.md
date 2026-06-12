# AI Interior Room Designer

**AI-powered interior design platform with customizable wall, floor, and ceiling texturing, 2D-to-3D object generation using Tencent Hunyuan3D, and real-time 3D room visualization — simply upload a photo of a sofa, table, or decor item and instantly place its generated 3D model inside your room.**

Everything runs **100% locally** on your own machine — no cloud APIs, no subscriptions, no usage limits. Your images never leave your computer.

---

# Demo

<img width="1662" height="768" alt="image" src="https://github.com/user-attachments/assets/c4bbb801-c300-46c9-9960-dbd800217d2c" />
<img width="800" height="366" alt="1" src="https://github.com/user-attachments/assets/8f49fcf0-0520-42ec-954e-1537bb67ed25" />
<img width="800" height="376" alt="6" src="https://github.com/user-attachments/assets/ddeac52a-16c0-48b8-8d12-aadbff227bf6" />
<img width="800" height="366" alt="2" src="https://github.com/user-attachments/assets/fa6e36e3-a838-4bf1-b63d-2e6fc4afb1d7" />
<img width="800" height="366" alt="3" src="https://github.com/user-attachments/assets/473ce4fd-b914-4dcc-8619-efd2adb9173b" />
<img width="800" height="312" alt="4" src="https://github.com/user-attachments/assets/d1e8f49e-9099-489a-8ec2-0fb506bbec74" />
<img width="800" height="376" alt="5" src="https://github.com/user-attachments/assets/e124dbfe-e974-4d45-80da-d27b3a4f4bb7" />
<img width="800" height="376" alt="7" src="https://github.com/user-attachments/assets/46b3a243-a24e-49bf-87c2-dacbe517e554" />
<img width="800" height="379" alt="8" src="https://github.com/user-attachments/assets/b25037dd-263b-4396-aacd-f543a4388543" />
<img width="800" height="381" alt="loading1" src="https://github.com/user-attachments/assets/8d7b5022-1291-4e6a-bbaf-9b8440f40baf" />
<img width="800" height="372" alt="loading3" src="https://github.com/user-attachments/assets/8e387f7a-5c3c-4c90-9b01-1d13654d3eca" />
<img width="800" height="200" alt="backend" src="https://github.com/user-attachments/assets/e91dc4f9-37dc-4137-956a-d4fe051b1d25" />




##  Who is this for?

- **Interior designers** — mock up a client's room, drop in real furniture from catalogue photos, and walk the client through a live 3D preview instead of static mood boards.
- **Homeowners & renters** — "will that sofa from the listing actually fit next to my window?" Upload the listing photo and find out.
- **Architects & visualizers** — rapid massing of decor concepts before committing to full CAD/render workflows.
- **3D / AI hobbyists** — a complete, working reference for integrating Tencent Hunyuan3D-2 into a web app on consumer hardware (yes, even a 4 GB laptop GPU).

---

##  Features

###  The Room
- A real **3D box room** — floor, ceiling, back wall, left wall, right wall, with an **open front** so you always have a clean view in.
- **Full orbit controls** — rotate, pan, and zoom around (and into) the room freely. Walls are solid: objects inside the room are correctly hidden when you view the box from outside.
- **Adjustable room dimensions** — live sliders for **width, height, and depth**. When you resize the room, every placed 3D object **rescales and repositions proportionally and precisely**, so a window you fixed on the back wall *stays* on the back wall, exactly where you put it.
- **Adjustable wall thickness** (0.02 m – 0.6 m) — controls how deep objects can be embedded into walls.

###  Surface Texturing
- Upload **any image** as the texture for the **floor, ceiling, back wall, left wall, or right wall** — each surface has its own upload slot and an independent show/hide toggle.
- Textures are applied flat to the surface, exactly like wallpaper / flooring.

###  2D → 3D Generation (the magic part)
Two complementary workflows, both powered by **Tencent Hunyuan3D-2** running locally:

1. **Generate from a surface texture** — uploaded a wall image that contains a window, a painting, a wall lamp? Draw a **bounding box** around that part of the image and the app converts *just that region* into a real 3D model, then **places it at the exact corresponding position** on that wall in the 3D room.
2. **Object Only mode** — upload any standalone photo (sofa, table, plant, home decor…), draw boxes around one or more objects, and each becomes a full 3D model placed in the room, ready to be moved anywhere. The source image is *not* applied to any wall.

Backgrounds are removed automatically (rembg/u2net) before generation, and each generated mesh receives an **AI-generated texture** from Hunyuan3D-Paint so it looks like the photo, not a grey blob.

###  Total Control over Every Object
Every generated 3D object is fully flexible. Two ways to control it:

**A. Directly in the 3D viewport** — click an object to select it and a gizmo toolbar appears:
| Mode | What it does |
|---|---|
| **Move** | Drag the object anywhere with axis arrows |
| **Rotate** | Spin it around any axis with rotation rings |
| **Scale** | Resize with axis handles |
| **Done** | Deselect |

**B. The precision control panel** — every object gets an expandable row with:
- **Attach to surface** — one-click snap buttons: *Floor / Ceiling / Back / Left / Right / Center*, plus *free-float* to detach.
- **Submerge into wall** — a depth slider (with *Flush / Half / Max* quick buttons) that sinks the object into the snapped surface, up to the full wall thickness — perfect for windows that sit *in* the wall rather than *on* it, recessed ceiling lights, embedded shelves. Works on **every axis** (walls = X/Z, floor/ceiling = Y). The wall is automatically cut away in the object's silhouette (stencil-buffer cutout), so no matter how deep you sink it, the wall **never** pokes through the object — even concave meshes like window frames render perfectly.
- **Size** — uniform scale slider, or switch to per-axis Width / Height / Depth in metres.
- **Position** — per-axis rows with **− / + nudge buttons** (5 cm steps), a range slider, a numeric input, and a *reset all* button.
- **Rotation** — Pitch / Yaw / Roll in **degrees**, plus quick buttons **⟲ 90° / 90° ⟳ / Flip / 0°** that automatically rotate around the correct axis for whatever surface the object is attached to.
- Show/hide toggle and delete per object; *Clear all* for the whole scene.

###  Room Lighting
- **On/Off switch** for the interior lights (a faint ambient stays on so the room never goes pitch black).
- **Three colour temperatures** — **Warm** (~2700 K cosy incandescent), **Neutral** (daylight white), **Cool** (~7000 K crisp blue-white) — selectable with one click.
- **Brightness slider** (0–3×) scaling the whole interior light rig: ceiling key light, front fill, side bounce lights, and ambient together.
- **Object brightness slider** — an independent control for how visible generated objects' textures stay in dim corners (a self-emissive floor on their materials), so your objects keep their exact colours under any lighting.
- A subtle exterior daylight always shines through the open front for realism.

---

##  Architecture

```
┌────────────────────────┐   HTTP (JSON/base64)    ┌──────────────────────────┐
│  Next.js 14 frontend   │ ──────────────────────► │  Flask backend           │
│  React Three Fiber     │   /api/generate3d proxy │  api_server.py :8080     │
│  three.js + zustand    │ ◄────────────────────── │                          │
│  Tailwind CSS          │      GLB binary         │  Hunyuan3D-DiT  (shape)  │
└────────────────────────┘                         │  Hunyuan3D-Paint (texture)│
                                                   │  rembg (bg removal)      │
                                                   │  trimesh (mesh ops)      │
                                                   └──────────────────────────┘
```

- The frontend never talks to the GPU directly — everything goes through the Flask API (`/generate` for shape, `/texture` for texturing, `/health` for status).
- **Pipelines load on demand and unload after each request**, so a single small GPU can run both shape and texture work (just not simultaneously). VRAM is freed between requests.
- If Hunyuan texturing fails on weak hardware (OOM / timeout), the backend **falls back to a fast UV-projection bake** of the reference photo, so you always get a textured object — never a crash.

```
room3d-viewer/
├── api_server.py              # Flask + Hunyuan3D backend
├── requirements.txt           # Python deps
├── .env.example               # backend configuration (copy to .env)
├── start_backend.ps1          # convenience launcher
├── start_frontend.ps1         # convenience launcher
├── scripts/
│   └── install_texture_windows.bat   # builds Hunyuan's C++ extensions
└── src/
    ├── app/                   # Next.js app router + /api/generate3d proxy
    ├── components/            # RoomViewer, SceneObjectLayer, upload panels…
    ├── lib/                   # hunyuan.js API client, positionClamp, surfaceSnap…
    └── store/                 # zustand room store
```

---

##  The AI models

| Role | Model | Size | Why this one |
|---|---|---|---|
| **Shape** (image → mesh) | `tencent/Hunyuan3D-2mini` / `hunyuan3d-dit-v2-mini` | 0.6 B | The smallest DiT in the family — fastest to load and run on low-VRAM GPUs, with quality that's excellent for interior-scale objects |
| **Texture** (mesh + image → textured mesh) | `tencent/Hunyuan3D-2` / `hunyuan3d-paint-v2-0-turbo` | 1.3 B | The **turbo** (step-distilled) paint model — far fewer diffusion steps than the standard paint model, which is the difference between *works* and *times out* on 4 GB |

> **My hardware & honest limitations:** this project was built and tested on an **NVIDIA RTX 3050 Laptop GPU with only 4 GB VRAM** + 16 GB DDR4 RAM. Tencent's official requirement is **6 GB for shape and 16 GB for shape+texture** — I'm running at a quarter of the texture requirement. It works because of a stack of mitigations baked into `api_server.py`:
> - `enable_model_cpu_offload()` (low-VRAM mode) shuttles sub-models between CPU and GPU
> - the **turbo** paint model (fewer steps)
> - meshes are **simplified to ≤ 20,000 vertices** before texturing (`fast_simplification`)
> - reference images are capped at **512 px**
> - FP16 weights
> - a 15-minute per-request timeout + automatic UV-bake fallback
>
> Typical timings on my 4 GB card: **~11 min** for a shape (30 steps + volume decoding), **~2–6 min** for a Hunyuan texture after simplification. **A better GPU gives you better speed AND quality** — with 8 GB+ you can raise `SIMPLIFY_MAX_VERTS` / `TEX_REF_MAX_DIM`, with 16 GB+ you can switch to the bigger DiT models and the non-turbo paint model via `.env` (no code changes needed).

### Where the weights live (important for cloners!)

**The model weights are NOT in this repo** (they're multi-GB). They **download automatically from Hugging Face on the first generation request** — you don't have to download anything manually. They are cached *outside* the project folder, in your user profile:

| What | Windows location |
|---|---|
| Hugging Face model weights (safetensors, VAE, UNet, etc.) | `C:\Users\<you>\.cache\huggingface\hub\models--tencent--Hunyuan3D-2mini\` and `...\models--tencent--Hunyuan3D-2\` |
| hy3dgen's own model path | `C:\Users\<you>\.cache\hy3dgen\` |

So the very first `/generate` and `/texture` calls will be slow (several GB of downloads); after that, everything loads from local cache. You'll see `Try to load model from local path … Model path not exists, try to download from huggingface` in the log on first run — that's normal.

> Note: the log line `Error no file named diffusion_pytorch_model.safetensors found … Defaulting to unsafe serialization` and the `Expected types for unet …` warning are **known-harmless quirks** of the Hunyuan paint model packaging. Ignore them.

---

##  Installation (Windows, step by step)

### Prerequisites
| Tool | Version | Notes |
|---|---|---|
| **Git** | any recent | [git-scm.com](https://git-scm.com/download/win) |
| **Anaconda / Miniconda** | any recent | for the Python environment |
| **Node.js** | 18 + (LTS recommended) | for the Next.js frontend |
| **NVIDIA GPU + driver** | CUDA-capable, 4 GB VRAM minimum | 6 GB+ recommended |
| **CUDA-enabled PyTorch** | 2.x with cu121/cu124 | installed below |
| **Visual Studio Build Tools 2019/2022** | "Desktop development with C++" workload | needed ONCE to compile Hunyuan's two C++ extensions — [download](https://visualstudio.microsoft.com/downloads/) |

### 1. Clone this repo
```powershell
git clone https://github.com/i7xmel/AI-Interior-Room-Designer.git
cd AI-Interior-Room-Designer
```

### 2. Create the conda environment (named `room3d`)
```powershell
conda create -n room3d python=3.10 -y
conda activate room3d
```

### 3. Install PyTorch with CUDA
Pick the command for your CUDA from [pytorch.org](https://pytorch.org/get-started/locally/) — e.g.:
```powershell
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```
Verify:
```powershell
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
# should print: True NVIDIA GeForce RTX ...
```

### 4. Clone Tencent Hunyuan3D-2 and install `hy3dgen`
The backend imports `hy3dgen` (Hunyuan's Python package), which is installed *from their repo*:
```powershell
cd D:\
git clone https://github.com/Tencent-Hunyuan/Hunyuan3D-2.git
cd Hunyuan3D-2
pip install -r requirements.txt
pip install -e .
```
> Keep the repo at `D:\Hunyuan3D-2` (or update `HUNYUAN_DIR` in `.env` and the installer script if you put it elsewhere).

### 5. Compile the two C++ texture extensions (one time)
Hunyuan3D-Paint needs `custom_rasterizer` and `differentiable_renderer` compiled natively. Open the **"x64 Native Tools Command Prompt for VS 2022"** (installed with Build Tools), then:
```bat
conda activate room3d
cd D:\AI-Interior-Room-Designer\scripts
install_texture_windows.bat D:\Hunyuan3D-2
```
The script builds both extensions and tells you when it's done. **Without this step, texture generation falls back to the lower-quality UV bake** (the app still works — you just don't get real Hunyuan textures).

### 6. Install the backend Python deps
```powershell
conda activate room3d
cd D:\AI-Interior-Room-Designer
pip install -r requirements.txt
pip install fast_simplification     # mesh decimation — REQUIRED on low-VRAM GPUs
```
(`requirements.txt` covers flask, flask-cors, python-dotenv, pillow, numpy, trimesh, rembg, …)

### 7. Configure the backend
```powershell
Copy-Item .env.example .env
```
The defaults are tuned for a 4 GB GPU. Key settings:

| Variable | Default | Meaning |
|---|---|---|
| `LOW_VRAM_MODE` | `true` | CPU offload for the texture pipeline — **keep `true` on ≤ 8 GB** |
| `USE_FP16` | `true` | half-precision weights |
| `SHAPE_REPO_ID` / `SHAPE_MODEL_SUBFOLDER` | `tencent/Hunyuan3D-2mini` / `hunyuan3d-dit-v2-mini` | shape model — swap for bigger DiT models if you have VRAM |
| `TEXTURE_MODEL_SUBFOLDER` | `hunyuan3d-paint-v2-0-turbo` | set to `hunyuan3d-paint-v2-0` for higher quality on ≥ 16 GB GPUs |
| `SIMPLIFY_MAX_VERTS` | `20000` | mesh vert cap before texturing (lower → less VRAM) |
| `TEX_REF_MAX_DIM` | `512` | reference image cap in px |
| `TEX_TIMEOUT_S` | `900` | per-texture-request timeout (seconds) |
| `FLASK_PORT` | `8080` | backend port (frontend proxy expects 8080) |

### 8. Install the frontend deps
```powershell
cd D:\AI-Interior-Room-Designer
npm install
```

### 9. Run it 
Two terminals:

**Terminal 1 — backend:**
```powershell
conda activate room3d
python api_server.py
# wait for:  Server ready on http://localhost:8080
```

**Terminal 2 — frontend:**
```powershell
npm run dev
# open http://localhost:3000
```
(Or use the included `start_backend.ps1` / `start_frontend.ps1`.)

The first generation downloads several GB of model weights from Hugging Face into `C:\Users\<you>\.cache\huggingface\hub` — give it time. Every run after that is local.

---

##  Quick usage walkthrough

1. **Set up the room** — drag the Width / Height / Depth sliders; upload textures to any of the five surfaces via their tabs.
2. **Make something 3D from a wall** — on a surface tab, click-drag a box around an object in the texture image (e.g. a window) and hit **Run**. After generation it appears at the matching spot on that wall.
3. **Or use Object Only** — switch to the *Object Only* tab, upload a product/decor photo, box the object(s), **Generate**. Each appears at the room centre.
4. **Place it** — click the object in the viewport and use **Move / Rotate / Scale**, or open its panel row for snap buttons, the submerge slider, ±nudges, degree rotation, and numeric inputs.
5. **Light it** — toggle the lights, pick Warm / Neutral / Cool, set brightness.
6. **Resize the room anytime** — your placed objects scale and stay anchored automatically.

---

##  Troubleshooting

| Symptom | Fix |
|---|---|
| `'Hunyuan3DPaintPipeline' object has no attribute 'to'` | You're running a modified backend that calls `.to()`/`.half()` on the paint pipeline — it's not a diffusers `Pipeline` and has neither. Use the `api_server.py` from this repo. |
| Texture comes back low quality / log says `mode=fallback` | The C++ extensions aren't built (step 5) **or** Hunyuan OOM'd / timed out. Build the extensions, install `fast_simplification`, lower `SIMPLIFY_MAX_VERTS` to 12000 and `TEX_REF_MAX_DIM` to 384. |
| `No module named 'fast_simplification'` / `target_reduction must be between 0 and 1` | `pip install fast_simplification` in the `room3d` env. The backend has multi-API fallbacks but the package must exist. |
| Texture request returns after exactly 15 min with fallback | That's the `TEX_TIMEOUT_S` safety net. Raise it, or lower the vert/image caps so Hunyuan finishes in time. |
| First run is extremely slow | It's downloading the model weights (one time). Watch the `Fetching N files` progress bars in the backend log. |
| CUDA out of memory during shape | Close other GPU apps; make sure `LOW_VRAM_MODE=true`; reduce `octree_resolution` in `api_server.py` if desperate. |
| Frontend says backend offline | Backend not running, or a port mismatch — frontend proxy expects `localhost:8080`. |

---

##  Credits

- **[Tencent Hunyuan3D-2](https://github.com/Tencent-Hunyuan/Hunyuan3D-2)** — the shape (Hunyuan3D-DiT) and texture (Hunyuan3D-Paint) models that make the 2D→3D magic possible. Please check and respect their model license for your use case.
- [Next.js](https://nextjs.org/) · [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) · [drei](https://github.com/pmndrs/drei) · [three.js](https://threejs.org/) · [zustand](https://github.com/pmndrs/zustand) · [Tailwind CSS](https://tailwindcss.com/)
- [Flask](https://flask.palletsprojects.com/) · [trimesh](https://trimesh.org/) · [rembg](https://github.com/danielgatis/rembg) · [fast_simplification](https://github.com/pyvista/fast-simplification)

## 📬 Contact

Anyone is welcome to clone this repo and build on it. Questions, ideas, or collaboration:

**📧 ismaeeel.basheer@gmail.com**
