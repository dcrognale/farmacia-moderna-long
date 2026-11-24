(function () {
  // Includes: reemplaza <div data-include="ruta"> por el HTML del parcial.
  // Requiere servir el sitio por HTTP (no funciona abriendo el archivo con file://).
  function loadIncludes() {
    var slots = document.querySelectorAll('[data-include]');
    return Promise.all(Array.prototype.map.call(slots, function (slot) {
      return fetch(slot.dataset.include)
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function (html) { slot.outerHTML = html; })
        .catch(function (e) { console.error('No se pudo cargar ' + slot.dataset.include, e); });
    }));
  }

  function init() {
  // Carrito (contador de demostración, persiste en la pestaña)
  var badges = document.querySelectorAll('[data-cart-count]');
  var count = parseInt(sessionStorage.getItem('fm-cart') || '0', 10);
  function render() { badges.forEach(function (b) { b.textContent = count; }); }
  render();
  document.querySelectorAll('[data-add-to-cart]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      count += 1; sessionStorage.setItem('fm-cart', count); render();
    });
  });

  // Carrusel de productos
  var track = document.getElementById('ns-item-list');
  document.querySelectorAll('[data-carousel]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (track) track.scrollBy({ left: b.dataset.carousel === 'next' ? 292 : -292, behavior: 'smooth' });
    });
  });

  // Libro de quejas: motivos según canal de compra
  var canal = document.getElementById('lq-canal');
  var motivo = document.getElementById('lq-motivo');
  if (canal && motivo) {
    var base = 'Seleccioná una opción de la lista';
    var motivos = {
      web: ['Consulta por pedido', 'Asesoramiento en compra', 'Compré y tengo una consulta con mi receta', 'Quiero cambiar o devolver un producto', 'Quiero anular mi pedido', 'Consulta por devolución de dinero', 'Consulta por mi factura', 'Promoción mal aplicada', 'Mi pedido tiene un faltante', 'Quiero cambiar el punto de entrega de mi pedido', 'Propuestas comerciales', 'Mala experiencia en sucursal', 'Me gustaría trabajar con ustedes', 'Quiero autorizar a un tercero a retirar mi compra', 'Sorteos', 'Newsletter'],
      sucursal: ['Asesoramiento en compra', 'Compré y tengo una consulta con mi receta', 'Quiero cambiar o devolver un producto', 'Consulta por mi factura', 'Promoción mal aplicada', 'Mi pedido tiene un faltante', 'Propuestas comerciales', 'Información de locales', 'Mala experiencia en sucursal', 'Me gustaría trabajar con ustedes', 'Vacuna', 'Sorteos', 'Envío de medicamentos a domicilio', 'Reserva']
    };
    canal.addEventListener('change', function () {
      motivo.innerHTML = '';
      [base].concat(motivos[canal.value] || []).forEach(function (t) {
        var o = document.createElement('option'); o.textContent = t; o.value = t === base ? '' : t; motivo.appendChild(o);
      });
    });
  }
  }

  loadIncludes().then(init);
})();
