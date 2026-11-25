import { $ } from '../lib/dom';

const BASE = 'Seleccioná una opción de la lista';
const MOTIVOS: Record<string, string[]> = {
  web: ['Consulta por pedido', 'Asesoramiento en compra', 'Compré y tengo una consulta con mi receta', 'Quiero cambiar o devolver un producto', 'Quiero anular mi pedido', 'Consulta por devolución de dinero', 'Consulta por mi factura', 'Promoción mal aplicada', 'Mi pedido tiene un faltante', 'Quiero cambiar el punto de entrega de mi pedido', 'Propuestas comerciales', 'Mala experiencia en sucursal', 'Me gustaría trabajar con ustedes', 'Quiero autorizar a un tercero a retirar mi compra', 'Sorteos', 'Newsletter'],
  sucursal: ['Asesoramiento en compra', 'Compré y tengo una consulta con mi receta', 'Quiero cambiar o devolver un producto', 'Consulta por mi factura', 'Promoción mal aplicada', 'Mi pedido tiene un faltante', 'Propuestas comerciales', 'Información de locales', 'Mala experiencia en sucursal', 'Me gustaría trabajar con ustedes', 'Vacuna', 'Sorteos', 'Envío de medicamentos a domicilio', 'Reserva'],
};

/** Libro de quejas: los motivos dependen del canal de compra. */
export function initComplaints(): void {
  const canal = $<HTMLSelectElement>('#lq-canal');
  const motivo = $<HTMLSelectElement>('#lq-motivo');
  if (!canal || !motivo) return;
  canal.addEventListener('change', () => {
    motivo.replaceChildren(...[BASE, ...(MOTIVOS[canal.value] ?? [])].map((t) => new Option(t, t === BASE ? '' : t)));
  });
}
