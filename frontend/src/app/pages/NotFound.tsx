import { Link } from "react-router";
import { AlertCircle } from "lucide-react";

export function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <AlertCircle className="w-16 h-16 text-gray-400 mb-4" />
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Page Not Found</h1>
      <p className="text-gray-500 mb-6 max-w-md">The module or page you are looking for does not exist or you don't have permission to view it.</p>
      <Link 
        to="/" 
        className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}