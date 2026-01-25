/**
 * AccessDeniedPage - Full-page access denied screen
 * 
 * Shown when user tries to access a route without required permissions.
 */

import { useNavigate } from 'react-router-dom';
import { ShieldX, ArrowLeft, Home } from 'lucide-react';

export default function AccessDeniedPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      {/* Icon */}
      <div className="w-24 h-24 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-6">
        <ShieldX className="w-12 h-12 text-red-500" />
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Acceso Restringido
      </h1>

      {/* Description */}
      <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-8">
        No tienes permiso para acceder a esta sección.
        Si crees que esto es un error, contacta a un administrador.
      </p>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
        >
          <Home className="w-4 h-4" />
          Ir al Dashboard
        </button>
      </div>

      {/* Additional info */}
      <div className="mt-12 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg max-w-md">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
          ¿Necesitas acceso?
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Contacta a un administrador del sistema para solicitar los permisos 
          necesarios para acceder a esta funcionalidad.
        </p>
      </div>
    </div>
  );
}

// Named export for compatibility
export { AccessDeniedPage };
