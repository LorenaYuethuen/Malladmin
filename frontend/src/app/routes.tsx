import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Products } from "./pages/Products";
import { ProductDetail } from "./pages/ProductDetail";
import { ProductForm } from "./pages/ProductForm";
import { CategoryManager } from "./pages/CategoryManager";
import { BrandManager } from "./pages/BrandManager";
import { Orders } from "./pages/Orders";
import { OrderDetail } from "./pages/OrderDetail";
import { Marketing } from "./pages/Marketing";
import Coupons from "./pages/Coupons";
import FlashSales from "./pages/FlashSales";
import Recommendations from "./pages/Recommendations";
import Advertisements from "./pages/Advertisements";
import { Users } from "./pages/Users";
import { Reviews } from "./pages/Reviews";
import { NotFound } from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "products", Component: Products },
      { path: "products/new", Component: ProductForm },
      { path: "products/:id", Component: ProductDetail },
      { path: "products/:id/edit", Component: ProductForm },
      { path: "categories", Component: CategoryManager },
      { path: "brands", Component: BrandManager },
      { path: "orders", Component: Orders },
      { path: "orders/:id", Component: OrderDetail },
      { path: "marketing", Component: Marketing },
      { path: "coupons", Component: Coupons },
      { path: "flash-sales", Component: FlashSales },
      { path: "recommendations", Component: Recommendations },
      { path: "advertisements", Component: Advertisements },
      { path: "reviews", Component: Reviews },
      { path: "users", Component: Users },
      { path: "*", Component: NotFound },
    ],
  },
]);