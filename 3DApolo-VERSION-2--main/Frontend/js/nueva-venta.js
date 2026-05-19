lucide.createIcons();
  document.getElementById('btn').addEventListener('click', () =>
    document.getElementById('menu').classList.toggle('activo'));
  document.getElementById('btn_modo').addEventListener('change', function() {
    document.body.classList.toggle('dark-mode', this.checked);
  });


    function cerrarSesion() {
  if (!confirm('¿Cerrar sesión?')) return;
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  fetch('/api/auth/logout', { method: 'POST' })
    .finally(() => window.location.replace('/login'));
}


function toast(msg,tipo='ok'){const t=document.getElementById('toast');t.textContent=msg;t.className='show '+tipo;setTimeout(()=>t.className='',3100);}
  const API='/api/ventas';
  let productos=[], carrito=[], productoActual=null;

  async function cargarCatalogos(){
    const d = await apiFetch(API+'/catalogos');
    productos=d.productos||[];
    const sel=document.getElementById('f-cliente');
    (d.clientes||[]).forEach(c=>{const o=document.createElement('option');o.value=c.id_cliente;o.textContent=c.nombre+(c.desc_esp?' ('+c.desc_esp+'%)':'');sel.appendChild(o);});
    renderProductos();
  }

  function renderProductos(){
    const buscar=document.getElementById('buscar-prod').value.toLowerCase();
    const tipo=document.getElementById('filtro-tipo').value;
    const lista=productos.filter(p=>
      (!buscar||p.nombre.toLowerCase().includes(buscar)) &&
      (!tipo||p.tipo===tipo)
    );
    const grid=document.getElementById('pos-grid');
    if(!lista.length){grid.innerHTML='<p style="color:#aaa;font-size:13px">Sin resultados</p>';return;}
    grid.innerHTML=lista.map(p=>`
      <div class="prod-card ${p.stock<=0?'sin-stock':''}" onclick="abrirModalCant(${p.id_producto})">
        <strong>${p.nombre}</strong>
        <p>${p.tipo}</p>
        <div class="precio">${Number(p.precio_venta).toLocaleString('es-CO')}</div>
        <div class="stock-tag">Stock: ${p.stock}</div>
      </div>`).join('');
  }

  function abrirModalCant(id){
    const p=productos.find(x=>x.id_producto===id);
    if(!p||p.stock<=0)return;
    productoActual=p;
    document.getElementById('mc-titulo').textContent=p.nombre;
    document.getElementById('mc-cant').value=1;
    document.getElementById('mc-desc').value=0;
    document.getElementById('mc-precio').value=p.precio_venta;
    document.getElementById('modal-cant').classList.add('open');
    lucide.createIcons();
  }

  function agregarDesdeModal(){
    const p=productoActual; if(!p)return;
    const cant=+document.getElementById('mc-cant').value||1;
    const desc=+document.getElementById('mc-desc').value||0;
    const precio=+document.getElementById('mc-precio').value||+p.precio_venta;
    if(cant>p.stock){toast('Stock insuficiente','err');return;}
    const idx=carrito.findIndex(x=>x.id_producto===p.id_producto);
    if(idx>=0){carrito[idx].cantidad+=cant;carrito[idx].desc_pct=desc;carrito[idx].precio_venta=precio;}
    else carrito.push({id_producto:p.id_producto,nombre:p.nombre,cantidad:cant,precio_venta:precio,desc_pct:desc,iva:+p.iva||0});
    document.getElementById('modal-cant').classList.remove('open');
    renderCarrito();
  }

  function renderCarrito(){
    const cont=document.getElementById('carrito-items');
    if(!carrito.length){cont.innerHTML='<p class="carrito-vacio">Selecciona productos</p>';actualizarTotales();return;}
    cont.innerHTML=carrito.map((it,i)=>`
      <div class="carrito-item">
        <div class="ci-nombre">${it.nombre}<br><small style="color:#aaa;font-weight:400">${it.desc_pct?it.desc_pct+'% desc':''}</small></div>
        <div class="ci-cant">
          <button onclick="cambiarCant(${i},-1)">−</button>
          <span>${it.cantidad}</span>
          <button onclick="cambiarCant(${i},1)">+</button>
        </div>
        <div class="ci-sub">${calcSub(it).toLocaleString('es-CO',{maximumFractionDigits:0})}</div>
        <button class="ci-del" onclick="quitarItem(${i})">✕</button>
      </div>`).join('');
    actualizarTotales();
  }

  function calcSub(it){
    const base=it.precio_venta*it.cantidad;
    const desc=base*it.desc_pct/100;
    const net=base-desc;
    return net+(net*it.iva/100);
  }

  function actualizarTotales(){
    let sub=0,desc=0,iva=0;
    carrito.forEach(it=>{
      const base=it.precio_venta*it.cantidad;
      const d=base*it.desc_pct/100;
      sub+=base; desc+=d; iva+=(base-d)*it.iva/100;
    });
    const fmt=v=>'$'+v.toLocaleString('es-CO',{maximumFractionDigits:0});
    document.getElementById('ct-sub').textContent=fmt(sub);
    document.getElementById('ct-desc').textContent=fmt(desc);
    document.getElementById('ct-iva').textContent=fmt(iva);
    document.getElementById('ct-total').textContent=fmt(sub-desc+iva);
  }

  function cambiarCant(i,d){
    const p=productos.find(x=>x.id_producto===carrito[i].id_producto);
    const nuevo=carrito[i].cantidad+d;
    if(nuevo<1)return quitarItem(i);
    if(p&&nuevo>p.stock){toast('Sin más stock','err');return;}
    carrito[i].cantidad=nuevo; renderCarrito();
  }

  function quitarItem(i){carrito.splice(i,1);renderCarrito();}

  async function registrarVenta(){
    if(!carrito.length){toast('Agrega productos al carrito','err');return;}
    const metodo=document.getElementById('f-metodo').value;
    if(!metodo){toast('Selecciona el método de pago','err');return;}
    const body={
      items: carrito.map(it=>({id_producto:it.id_producto,cantidad:it.cantidad,precio_venta:it.precio_venta,desc_pct:it.desc_pct})),
      metodo_pago:    metodo,
      tipo_venta:     document.getElementById('f-tipo-venta').value,
      tipo_entrega:   document.getElementById('f-tipo-entrega').value,
      id_cliente:     document.getElementById('f-cliente').value||null,
      notas:          document.getElementById('f-notas').value,
    };
    const data=await apiFetch(API, {method:'POST', body:JSON.stringify(body)});
    if(!data?.error){
      toast('Venta registrada — Total: $'+Number(data.total).toLocaleString('es-CO',{maximumFractionDigits:0}));
      carrito=[]; renderCarrito();
      document.getElementById('f-metodo').value='';
      document.getElementById('f-notas').value='';
      // Recargar stocks
      cargarCatalogos();
    } else toast(data.error||'Error al registrar','err');
  }

  document.getElementById('buscar-prod').addEventListener('input',renderProductos);
  document.getElementById('filtro-tipo').addEventListener('change',renderProductos);
  cargarCatalogos();
