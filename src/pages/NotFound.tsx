import { useNavigate } from 'react-router-dom';

function NotFound() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="mt-2 text-xl text-gray-600">Page not found</p>
      <p className="mt-4 text-gray-500">The page you are looking for doesn't exist or has been moved.</p>
      
      <button 
        onClick={() => navigate('/')}
        className="mt-8 btn-primary"
      >
        Go to Dashboard
      </button>
    </div>
  );
}

export default NotFound;