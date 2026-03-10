import { Outlet, Link, useLocation } from "react-router";
import { 
  LayoutDashboard, 
  Box, 
  ShoppingCart, 
  Megaphone, 
  Star, 
  Users, 
  Bell, 
  Search, 
  ChevronDown
} from "lucide-react";

export function Layout() {
  const location = useLocation();
  
  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { 
      name: "Products (PMS)", 
      href: "/products", 
      icon: Box,
      subItems: [
        { name: "All Products", href: "/products" },
        { name: "Categories", href: "/categories" },
        { name: "Brands", href: "/brands" },
      ]
    },
    { name: "Orders (OMS)", href: "/orders", icon: ShoppingCart },
    { name: "Marketing (SMS)", href: "/marketing", icon: Megaphone },
    { name: "Reviews (RMS)", href: "/reviews", icon: Star },
    { name: "Users (UMS)", href: "/users", icon: Users },
  ];

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-gray-200 shrink-0">
          <div className="text-xl font-bold text-indigo-600 flex items-center gap-2">
            <Box className="w-6 h-6" />
            MallAdmin Plus
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || (item.href !== "/" && location.pathname.startsWith(item.href));
            const hasSubItems = 'subItems' in item && item.subItems;
            
            return (
              <div key={item.name}>
                <Link
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive 
                      ? "bg-indigo-50 text-indigo-700" 
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? "text-indigo-600" : "text-gray-400"}`} />
                  {item.name}
                </Link>
                
                {hasSubItems && isActive && (
                  <div className="ml-8 mt-1 space-y-1">
                    {item.subItems.map((subItem) => {
                      const isSubActive = location.pathname === subItem.href;
                      return (
                        <Link
                          key={subItem.href}
                          to={subItem.href}
                          className={`block px-3 py-1.5 rounded-md text-sm transition-colors ${
                            isSubActive
                              ? "text-indigo-700 font-medium"
                              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                          }`}
                        >
                          {subItem.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-64 max-w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search systems..." 
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-gray-50">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Admin View
              <ChevronDown className="w-4 h-4" />
            </div>
            <button className="relative text-gray-500 hover:text-gray-700 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center gap-3 border-l border-gray-200 pl-6">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                A
              </div>
              <div className="text-sm font-medium text-gray-700 hidden sm:block">Admin User</div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50/50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}