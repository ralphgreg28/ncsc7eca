import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

function NotFound() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);
  
  useEffect(() => {
    // Set up the countdown timer
    const timer = setInterval(() => {
      setCountdown((prevCount) => {
        // When countdown reaches 0, navigate to home
        if (prevCount <= 1) {
          clearInterval(timer);
          navigate('/');
          return 0;
        }
        return prevCount - 1;
      });
    }, 1000);
    
    // Clean up the timer when component unmounts
    return () => clearInterval(timer);
  }, [navigate]);
  
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="mt-2 text-xl text-gray-600">Page not found</p>
      <p className="mt-4 text-gray-500">The page you are looking for doesn't exist or has been moved.</p>
      
      <div className="mt-6 text-lg text-blue-600 font-medium">
        Redirecting to Home in <span className="font-bold">{countdown}</span> seconds...
      </div>
      
      <button 
        onClick={() => navigate('/')}
        className="mt-8 btn-primary"
      >
        Go to Home Now
      </button>
    </div>
  );
}

export default NotFound;
