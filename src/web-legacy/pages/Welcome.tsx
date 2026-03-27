import { useNavigate } from "react-router";
import earthIllustration from "../../../assets/earth_illustration.png";

export function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative circles - top left */}
      <div className="absolute -top-32 -left-32 size-80 bg-emerald-200/70 rounded-full pointer-events-none"></div>
      <div className="absolute top-0 left-0 size-56 bg-emerald-300/60 rounded-full pointer-events-none"></div>

      {/* Decorative circles - bottom right */}
      <div className="absolute -bottom-32 -right-32 size-96 bg-emerald-200/70 rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 size-64 bg-emerald-300/60 rounded-full pointer-events-none"></div>

      <div className="max-w-sm w-full relative z-10 flex flex-col items-center">
        {/* Title */}
        <h1 className="text-5xl text-emerald-600 mb-8 text-center" style={{ fontFamily: 'Urbanist, sans-serif' }}>
          bin<span className="font-semibold">Go</span>
        </h1>

        {/* Illustration */}
        <div className="flex justify-center mb-6">
          <img
            src={earthIllustration}
            alt="People caring for Earth"
            className="w-64 h-auto"
          />
        </div>

        {/* Tagline */}
        <p className="text-center text-slate-900 font-medium mb-8 text-base">
          Manage your waste effectively!
        </p>

        {/* Get Started Button */}
        <button
          onClick={() => navigate("/register")}
          className="w-full max-w-[280px] bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3.5 px-6 rounded-xl shadow-md hover:shadow-lg transition-all"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}