(() => {
  const cfg = window.MAMUSHKA_CONFIG || {};
  const validConfig = cfg.SUPABASE_URL?.startsWith("https://") && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.includes("PEGAR_");
  const db = validConfig ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const $ = id => document.getElementById(id);
  let currentUser = null;
  let existingImages = [];
  let selectedFiles = [];
  const bucket = "product-images";
  const money = n => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(Number(n||0));
  const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const message = (id,txt,error=false) => { $(id).textContent=txt; $(id).classList.toggle("error",error); };
  const toast = txt => { $("adminToast").textContent=txt; $("adminToast").classList.add("show"); setTimeout(()=>$("adminToast").classList.remove("show"),2800); };

  function showDashboard(user) {
    currentUser=user; $("loginPanel").classList.add("hidden"); $("dashboard").classList.remove("hidden"); $("logoutButton").classList.remove("hidden"); loadAdminProducts();
  }
  function showLogin() {
    currentUser=null; $("dashboard").classList.add("hidden"); $("loginPanel").classList.remove("hidden"); $("logoutButton").classList.add("hidden");
  }

  async function init() {
    if (!db) { message("loginMessage","Primero configurá Supabase en supabase-config.js.",true); return; }
    const {data:{session}} = await db.auth.getSession();
    if(session) showDashboard(session.user); else showLogin();
    db.auth.onAuthStateChange((_event,session)=>{ if(session) showDashboard(session.user); else showLogin(); });
  }

  $("loginForm").addEventListener("submit",async e=>{
    e.preventDefault();
    if(!db){message("loginMessage","Falta configurar Supabase.",true);return;}
    message("loginMessage","Ingresando...");
    const {error}=await db.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});
    if(error) message("loginMessage","No pudimos iniciar sesión. Revisá el email y la contraseña.",true);
  });

  $("logoutButton").addEventListener("click",async()=>{if(db)await db.auth.signOut();});
  $("imageFiles").addEventListener("change",e=>{
    const incoming=Array.from(e.target.files||[]);
    const remaining=5-existingImages.length-selectedFiles.length;
    if(incoming.length>remaining){toast(`Podés tener hasta 5 fotos. Te quedan ${remaining} lugar(es).`);e.target.value="";return;}
    const bad=incoming.find(f=>!f.type.startsWith("image/"));
    if(bad){toast("Elegí solamente archivos de imagen.");e.target.value="";return;}
    selectedFiles.push(...incoming); e.target.value=""; renderPreviews();
  });

  function renderPreviews() {
    const host=$("imagePreviewGrid");
    const existing=existingImages.map((src,i)=>({src,kind:"existing",index:i}));
    const fresh=selectedFiles.map((file,i)=>({src:URL.createObjectURL(file),kind:"new",index:i}));
    host.innerHTML=[...existing,...fresh].map(item=>`<div class="preview-image"><img src="${item.src}" alt="Foto del producto"><button type="button" data-remove-${item.kind}="${item.index}" aria-label="Quitar foto">×</button></div>`).join("");
    host.querySelectorAll("[data-remove-existing]").forEach(b=>b.addEventListener("click",()=>{existingImages.splice(Number(b.dataset.removeExisting),1);renderPreviews();}));
    host.querySelectorAll("[data-remove-new]").forEach(b=>b.addEventListener("click",()=>{selectedFiles.splice(Number(b.dataset.removeNew),1);renderPreviews();}));
  }


// Comprime y redimensiona una imagen antes de subirla a Supabase.
async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      try {
        const maxWidth = 1000;
        const maxHeight = 1000;

        let width = image.width;
        let height = image.height;

        // Mantener proporciones y limitar las dimensiones.
        const scale = Math.min(
          maxWidth / width,
          maxHeight / height,
          1
        );

        width = Math.round(width * scale);
        height = Math.round(height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("No se pudo procesar la imagen.");
        }

        context.drawImage(image, 0, 0, width, height);

        canvas.toBlob(
          blob => {
            URL.revokeObjectURL(objectUrl);

            if (!blob) {
              reject(new Error("No se pudo comprimir la imagen."));
              return;
            }

            // Crear un archivo WebP optimizado.
            const compressedFile = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, "") + ".webp",
              {
                type: "image/webp",
                lastModified: Date.now()
              }
            );

            resolve(compressedFile);
          },
          "image/webp",
          0.8
        );

      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo abrir una de las imágenes."));
    };

    image.src = objectUrl;
  });
}


// Sube las imágenes comprimidas a Supabase Storage.
async function uploadImages() {
  const urls = [...existingImages];

  for (const originalFile of selectedFiles) {

    // Comprimir antes de subir.
    const file = await compressImage(originalFile);

    const path = `${currentUser.id}/${crypto.randomUUID()}.webp`;

    const { error } = await db.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: "image/webp"
      });

    if (error) throw error;

    const { data } = db.storage
      .from(bucket)
      .getPublicUrl(path);

    urls.push(data.publicUrl);
  }

  return urls;
}


  $("productForm").addEventListener("submit",async e=>{
    e.preventDefault();
    if(!db||!currentUser)return;
    const id=$("productId").value;
    if(!id && !selectedFiles.length){message("saveMessage","Agregá al menos una foto para publicar.",true);return;}
    if(existingImages.length+selectedFiles.length>5){message("saveMessage","El máximo es de 5 fotos.",true);return;}
    const save=$("saveButton"); save.disabled=true; save.textContent="Guardando publicación...";
    message("saveMessage","Subiendo fotos y guardando producto...");
    try{
      const images=await uploadImages();
      const payload={
        name:$("productName").value.trim(),
        description:$("productDescription").value.trim(),
        price:Number($("productPrice").value),
        category:$("productCategory").value,
        sizes:$("productSizes").value.split(",").map(x=>x.trim()).filter(Boolean),
        colors:$("productColors").value.split(",").map(x=>x.trim()).filter(Boolean),
        status:$("productStatus").value,
        tag:$("productTag").value || null,
        images
      };
      if(!payload.name || !Number.isFinite(payload.price) || payload.price<0) throw new Error("Revisá el nombre y el precio.");
      const result=id ? await db.from("products").update(payload).eq("id",id) : await db.from("products").insert(payload);
      if(result.error) throw result.error;
      resetForm(); message("saveMessage","¡Publicación guardada!"); toast("Producto guardado correctamente."); await loadAdminProducts();
    }catch(err){console.error(err);message("saveMessage",err.message||"No se pudo guardar el producto.",true);}
    finally{save.disabled=false;save.textContent=id?"Guardar cambios":"Publicar producto";}
  });

  async function loadAdminProducts(){
    if(!db)return;
    $("adminProductList").innerHTML='<p class="muted">Cargando...</p>';
    const {data,error}=await db.from("products").select("*").order("created_at",{ascending:false});
    if(error){$("adminProductList").innerHTML='<p class="form-message error">No se pudo cargar el catálogo. Revisá las políticas de Supabase.</p>';return;}
    $("adminProductCount").textContent=data.length;
    if(!data.length){$("adminProductList").innerHTML='<div class="empty-admin">Todavía no publicaste productos.<br>Tu primera publicación empieza acá ✿</div>';return;}
    $("adminProductList").innerHTML=data.map(p=>{
      const image=(p.images||[])[0]||"https://placehold.co/100x120/f8e9ed/9b6474?text=Foto";
      const labels={published:"Publicado",sold_out:"Sin stock",draft:"Borrador",hidden:"Oculto"};
      return `<article class="admin-product-row"><img src="${esc(image)}" alt=""><div class="admin-product-meta"><strong>${esc(p.name)}</strong><span>${money(p.price)} · ${esc(p.category)}</span><small class="status-${esc(p.status)}">${labels[p.status]||p.status}</small></div><div class="row-actions"><button type="button" data-edit="${esc(p.id)}">Editar</button><button type="button" data-delete="${esc(p.id)}" class="danger-link">Eliminar</button></div></article>`;
    }).join("");
    $("adminProductList").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editProduct(data.find(p=>String(p.id)===b.dataset.edit))));
    $("adminProductList").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>deleteProduct(b.dataset.delete)));
  }

  function editProduct(p){
    if(!p)return;
    $("productId").value=p.id; $("productName").value=p.name||""; $("productPrice").value=p.price??"";
    $("productCategory").value=p.category||"Indumentaria"; $("productDescription").value=p.description||"";
    $("productSizes").value=(p.sizes||[]).join(", "); $("productColors").value=(p.colors||[]).join(", ");
    $("productStatus").value=p.status||"published"; $("productTag").value=p.tag||"";
    existingImages=[...(p.images||[])]; selectedFiles=[]; renderPreviews();
    $("formTitle").textContent="Editar publicación"; $("saveButton").textContent="Guardar cambios"; $("cancelEdit").classList.remove("hidden");
    window.scrollTo({top:0,behavior:"smooth"});
  }

  async function deleteProduct(id){
    if(!confirm("¿Eliminar este producto? Esta acción no se puede deshacer."))return;
    const {error}=await db.from("products").delete().eq("id",id);
    if(error){toast("No se pudo eliminar el producto.");console.error(error);return;}
    toast("Producto eliminado."); if($("productId").value===id)resetForm(); loadAdminProducts();
  }

  function resetForm(){
    $("productForm").reset(); $("productId").value=""; existingImages=[]; selectedFiles=[]; renderPreviews();
    $("formTitle").textContent="¿Qué vamos a publicar?"; $("saveButton").textContent="Publicar producto"; $("cancelEdit").classList.add("hidden");
  }
  $("cancelEdit").addEventListener("click",resetForm);
  init();
})();
