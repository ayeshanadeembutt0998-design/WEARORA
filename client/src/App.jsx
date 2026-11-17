import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Boxes, ClipboardList, History, LayoutGrid, RefreshCcw, ScanLine, UserCircle, Users } from 'lucide-react';
import CustomerLayout from './layouts/CustomerLayout';
import PanelLayout from './layouts/PanelLayout';
import ProtectedRoute, { GuestOnly } from './routes/ProtectedRoute';
import { PageLoader } from './components/ui';

const L = (f) => lazy(f);
const Products = L(() => import('./pages/customer/Products'));
const ProductDetails = L(() => import('./pages/customer/ProductDetails'));
const About = L(() => import('./pages/customer/Static').then((m) => ({ default: m.About })));
const Contact = L(() => import('./pages/customer/Static').then((m) => ({ default: m.Contact })));
const Privacy = L(() => import('./pages/customer/Static').then((m) => ({ default: m.Privacy })));
const Terms = L(() => import('./pages/customer/Static').then((m) => ({ default: m.Terms })));
const Cart = L(() => import('./pages/customer/Cart'));
const Checkout = L(() => import('./pages/customer/Checkout'));
const OrderSuccess = L(() => import('./pages/customer/OrderSuccess'));
const MyOrders = L(() => import('./pages/customer/MyOrders'));
const OrderDetails = L(() => import('./pages/customer/OrderDetails'));
const Profile = L(() => import('./pages/customer/Profile'));
const CompleteProfile = L(() => import('./pages/customer/CompleteProfile'));
const VerifyReceipt = L(() => import('./pages/customer/VerifyReceipt'));
const SignIn = L(() => import('./pages/customer/Auth').then((m) => ({ default: m.SignIn })));
const SignUp = L(() => import('./pages/customer/Auth').then((m) => ({ default: m.SignUp })));
const ForgotPassword = L(() => import('./pages/customer/Auth').then((m) => ({ default: m.ForgotPassword })));
const VerifyOtp = L(() => import('./pages/customer/Auth').then((m) => ({ default: m.VerifyOtp })));
const ResetPassword = L(() => import('./pages/customer/Auth').then((m) => ({ default: m.ResetPassword })));
const StaffLogin = L(() => import('./pages/StaffLogin'));
const ProductsManagement = L(() => import('./pages/admin/ProductsManagement'));
const OrdersManagement = L(() => import('./pages/admin/OrdersManagement'));
const CashierManagement = L(() => import('./pages/admin/CashierManagement'));
const StaffProfile = L(() => import('./pages/StaffProfile'));
const NewSale = L(() => import('./pages/cashier/NewSale'));
const SalesHistory = L(() => import('./pages/cashier/SalesHistory'));
const ReturnsExchanges = L(() => import('./pages/cashier/ReturnsExchanges'));

const adminNav = [
  { to: '/admin/products', label: 'Products Management', icon: Boxes },
  { to: '/admin/orders', label: 'Orders Management', icon: ClipboardList },
  { to: '/admin/cashiers', label: 'Cashier Management', icon: Users },
  { to: '/admin/profile', label: 'Admin Profile', icon: UserCircle },
];
const cashierNav = [
  { to: '/cashier/new-sale', label: 'New Sale', icon: ScanLine },
  { to: '/cashier/sales', label: 'Sales History', icon: History },
  { to: '/cashier/returns', label: 'Returns & Exchanges', icon: RefreshCcw },
  { to: '/cashier/profile', label: 'Cashier Profile', icon: UserCircle },
];

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<CustomerLayout />}>
          <Route index element={<Navigate to="/products" replace />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductDetails />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/verify-receipt/:number" element={<VerifyReceipt />} />
          <Route path="/signin" element={<GuestOnly><SignIn /></GuestOnly>} />
          <Route path="/signup" element={<GuestOnly><SignUp /></GuestOnly>} />
          <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
          <Route path="/verify-otp" element={<GuestOnly><VerifyOtp /></GuestOnly>} />
          <Route path="/reset-password" element={<GuestOnly><ResetPassword /></GuestOnly>} />
          <Route element={<ProtectedRoute role="customer" />}>
            <Route path="/complete-profile" element={<CompleteProfile />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order-success/:id" element={<OrderSuccess />} />
            <Route path="/orders" element={<MyOrders />} />
            <Route path="/orders/:id" element={<OrderDetails />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>

        <Route path="/admin/login" element={<GuestOnly role="admin"><StaffLogin portal="admin" /></GuestOnly>} />
        <Route path="/admin" element={<ProtectedRoute role="admin" />}>
          <Route element={<PanelLayout items={adminNav} roleLabel="Admin" loginPath="/admin/login" />}>
            <Route index element={<Navigate to="products" replace />} />
            <Route path="products" element={<ProductsManagement />} />
            <Route path="orders" element={<OrdersManagement />} />
            <Route path="cashiers" element={<CashierManagement />} />
            <Route path="profile" element={<StaffProfile />} />
          </Route>
        </Route>

        <Route path="/cashier/login" element={<GuestOnly role="cashier"><StaffLogin portal="cashier" /></GuestOnly>} />
        <Route path="/cashier" element={<ProtectedRoute role="cashier" />}>
          <Route element={<PanelLayout items={cashierNav} roleLabel="Cashier POS" loginPath="/cashier/login" />}>
            <Route index element={<Navigate to="new-sale" replace />} />
            <Route path="new-sale" element={<NewSale />} />
            <Route path="sales" element={<SalesHistory />} />
            <Route path="returns" element={<ReturnsExchanges />} />
            <Route path="profile" element={<StaffProfile />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/products" replace />} />
      </Routes>
    </Suspense>
  );
}
