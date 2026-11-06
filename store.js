(() => {
  const cfg = window.MAMUSHKA_CONFIG || {};
  const hasConfig = cfg.SUPABASE_URL?.startsWith("https://") && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.includes("PEGAR_");
  const db = hasConfig ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const grid = document.getElementById("productsGrid");
  const count = document.getElementById("productCount");
  const empty = document.getElementById("emptyState");
  const modal = document.getElementById("productModal");
  let allProducts = [];
  let activeCategory = "Todos";
  let selectedProduct = null;
  let selectedSize = "";
  let selectedColor = "";
  let activeImage = 0;

  const money = n => new Intl.NumberFormat("es-AR", {style:"currency", currency:"ARS", maximumFractionDigits:0}).format(Number(n || 0));
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const photos = p => Array.isArray(p.images) ? p.images : (p.image_url ? [p.image_url] : []);
  const waNumber = () => String(cfg.WHATSAPP_NUMBER || "").replace(/\D/g, "");
  const toast = msg => { const el=document.getElementById("toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2800); };

  function whatsappUrl(message) {
    const n = waNumber();
    if (!/^549\d{10}$/.test(n)) { toast("Falta configurar el WhatsApp de Mamushka en supabase-config.js."); return "#"; }
    return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
  }

  function openGeneralWhatsApp() {
    const url = whatsappUrl("Hola Mamushka! Quisiera hacer una consulta sobre sus productos.");
    if (url !== "#") window.open(url, "_blank", "noopener,noreferrer");
  }

  async function loadProducts() {
    if (!db) {
      grid.innerHTML = `<div class="setup-message"><strong>La tienda ya está preparada.</strong><p>Para mostrar productos reales, falta conectar las credenciales de Supabase en <code>supabase-config.js</code> y ejecutar el SQL de configuración.</p><a href="admin.html">Ir al panel de administración ↗</a></div>`;
      count.textContent = "Configuración pendiente";
      return;
    }
    const {data, error} = await db.from("products").select("*").in("status", ["published","sold_out"]).order("created_at", {ascending:false});
    if (error) {
      grid.innerHTML = `<div class="setup-message">No pudimos cargar el catálogo. Revisá la conexión y las políticas de Supabase.</div>`;
      console.error(error); return;
    }
    allProducts = data || [];
    renderProducts();
  }

  function renderProducts() {
    const q = (document.getElementById("searchInput").value || "").trim().toLowerCase();
    const list = allProducts.filter(p => (activeCategory==="Todos" || p.category===activeCategory) &&
      [p.name,p.description,p.category].join(" ").toLowerCase().includes(q));
    count.textContent = `${list.length} ${list.length===1?"producto":"productos"}`;
    empty.classList.toggle("hidden", list.length>0);
    grid.innerHTML = list.map(p => {
      const image = photos(p)[0] || "https://placehold.co/700x850/f8e9ed/9b6474?text=Mamushka";
      const sold = p.status === "sold_out";
      return `<article class="product-card ${sold?"is-sold":""}">
        <button class="product-photo-button" data-open="${esc(p.id)}" aria-label="Ver ${esc(p.name)}">
          <img src="${esc(image)}" alt="${esc(p.name)}" loading="lazy">
          ${p.tag?`<span class="product-tag">${esc(p.tag)}</span>`:""}
          ${sold?`<span class="sold-overlay">SIN STOCK</span>`:""}
          <span class="photo-count">${photos(p).length>1?`＋${photos(p).length-1} fotos`:"Ver detalle"} </span>
        </button>
        <div class="product-card-info"><p class="product-category">${esc(p.category||"MAMUSHKA")}</p>
          <h3>${esc(p.name)}</h3><p class="product-card-description">${esc(p.description||"")}</p>
          <strong class="product-card-price">${money(p.price)}</strong>
          <button class="card-consult" data-open="${esc(p.id)}">${sold?"Consultar reposición":"Consultar / reservar"} <span>↗</span></button>
        </div></article>`;
    }).join("");
  }



function openProduct(id) {
  selectedProduct = allProducts.find(
    p => String(p.id) === String(id)
  );

  if (!selectedProduct) return;

  selectedSize = "";
  selectedColor = "";
  activeImage = 0;

  document.getElementById("modalName").textContent =
    selectedProduct.name;

  document.getElementById("modalCategory").textContent =
    selectedProduct.category || "MAMUSHKA";

  document.getElementById("modalPrice").textContent =
    money(selectedProduct.price);

  // Mostrar siempre la descripción.
  document.getElementById("modalDescription").textContent =
    selectedProduct.description || "";

  document.getElementById("availabilityNote").textContent =
    selectedProduct.status === "sold_out"
      ? "Este producto figura sin stock. Consultanos por reposición."
      : "La disponibilidad se confirma por WhatsApp antes de cerrar la compra.";

  const sizes = Array.isArray(selectedProduct.sizes)
    ? selectedProduct.sizes
    : [];

  const colors = Array.isArray(selectedProduct.colors)
    ? selectedProduct.colors
    : [];

  // Mostrar siempre los talles disponibles.
  document.getElementById("modalSizesWrap").classList.remove("hidden");

  document.getElementById("modalSizes").innerHTML =
    sizes.map(s => `
      <button
        class="option-chip"
        data-size="${esc(s)}"
        type="button"
      >${esc(s)}</button>
    `).join("");

  // Mostrar siempre los colores disponibles.
  document.getElementById("modalColorsWrap").classList.remove("hidden");

  document.getElementById("modalColors").innerHTML =
    colors.map(c => `
      <button
        class="option-chip"
        data-color="${esc(c)}"
        type="button"
      >${esc(c)}</button>
    `).join("");

  renderModalImage();

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}



  function renderModalImage() {
    const imgs = photos(selectedProduct);
    const main = document.getElementById("modalMainImage");
    main.src = imgs[activeImage] || "https://placehold.co/700x850/f8e9ed/9b6474?text=Mamushka";
    main.alt = selectedProduct.name;
    document.getElementById("modalThumbnails").innerHTML = imgs.map((src,i)=>`<button class="thumb ${i===activeImage?"active":""}" data-image="${i}"><img src="${esc(src)}" alt="Foto ${i+1}"></button>`).join("");
  }

  function closeModal() { modal.classList.add("hidden"); modal.setAttribute("aria-hidden","true"); document.body.classList.remove("modal-open"); }
 

function sendProductWhatsApp() {
  if (!selectedProduct) return;

  const sizes = Array.isArray(selectedProduct.sizes)
    ? selectedProduct.sizes
    : [];

  const colors = Array.isArray(selectedProduct.colors)
    ? selectedProduct.colors
    : [];

  // Si existe una sola opción, se utiliza automáticamente.
  // Si hay varias, se respeta la selección del cliente.
  const finalSize = sizes.length === 1
    ? String(sizes[0])
    : selectedSize;

  const finalColor = colors.length === 1
    ? String(colors[0])
    : selectedColor;

  // Validar solamente cuando hay múltiples opciones.
  if (sizes.length > 1 && !finalSize) {
    toast("Por favor, elegí un talle para continuar.");
    return;
  }

  if (colors.length > 1 && !finalColor) {
    toast("Por favor, elegí un color para continuar.");
    return;
  }

  // Armar mensaje con las opciones correspondientes.
  const msg = `Hola Mamushka! Quisiera consultar por este producto:

Producto: ${selectedProduct.name}
Precio: ${money(selectedProduct.price)}
${finalSize ? `Talle: ${finalSize}\n` : ""}${finalColor ? `Color: ${finalColor}\n` : ""}
¿Podrían confirmarme si está disponible? Muchas gracias.`;

  const url = whatsappUrl(msg);

  if (url && url !== "#") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}



  grid.addEventListener("click", e => { const b=e.target.closest("[data-open]"); if(b) openProduct(b.dataset.open); });
  document.getElementById("categoryFilters").addEventListener("click", e => {
    const b=e.target.closest("[data-category]"); if(!b)return;
    activeCategory=b.dataset.category;
    document.querySelectorAll(".filter-pill").forEach(x=>x.classList.toggle("active",x===b));
    renderProducts();
  });
  document.getElementById("searchInput").addEventListener("input", renderProducts);
  document.getElementById("modalSizes").addEventListener("click",e=>{const b=e.target.closest("[data-size]");if(!b)return;selectedSize=b.dataset.size;document.querySelectorAll("#modalSizes .option-chip").forEach(x=>x.classList.toggle("selected",x===b));});
  document.getElementById("modalColors").addEventListener("click",e=>{const b=e.target.closest("[data-color]");if(!b)return;selectedColor=b.dataset.color;document.querySelectorAll("#modalColors .option-chip").forEach(x=>x.classList.toggle("selected",x===b));});
  document.getElementById("modalThumbnails").addEventListener("click",e=>{const b=e.target.closest("[data-image]");if(!b)return;activeImage=Number(b.dataset.image);renderModalImage();});
  modal.addEventListener("click",e=>{if(e.target.matches("[data-close-modal]"))closeModal();});
  document.getElementById("modalWhatsapp").addEventListener("click",sendProductWhatsApp);
  document.getElementById("mobileMenu").addEventListener("click",()=>document.querySelector(".desktop-nav").classList.toggle("nav-open"));
  document.querySelectorAll(".desktop-nav a").forEach(a=>a.addEventListener("click",()=>document.querySelector(".desktop-nav").classList.remove("nav-open")));
  document.getElementById("headerWhatsapp").addEventListener("click",e=>{e.preventDefault();openGeneralWhatsApp();});
  document.getElementById("footerWhatsapp").addEventListener("click",e=>{e.preventDefault();openGeneralWhatsApp();});
  document.getElementById("year").textContent = new Date().getFullYear();
  loadProducts();
})();
