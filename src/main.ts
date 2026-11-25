import { mountLayout } from './ui/layout';
import { getStore } from './lib/tiendanube/catalog';
import { setCurrency } from './lib/format';
import { initHome } from './pages/home';
import { initCatalog } from './pages/catalog';
import { initProduct } from './pages/product';
import { initComplaints } from './pages/complaints';

const page = document.body.dataset.page;

if (page !== 'wip') {
  mountLayout();
  // Moneda de la tienda (los precios de la API son strings en esa moneda).
  void getStore().then((s) => setCurrency(s.currency)).catch(() => undefined);
}

switch (page) {
  case 'home': initHome(); break;
  case 'catalog': initCatalog(); break;
  case 'product': initProduct(); break;
  case 'complaints': initComplaints(); break;
}
