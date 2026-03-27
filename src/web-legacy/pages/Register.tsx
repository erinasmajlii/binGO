import { useState } from "react";
import { useNavigate } from "react-router";

export function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    address: "",
    acceptTerms: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Navigate to home after registration
    navigate("/");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 to-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative circles - top left */}
      <div className="absolute -top-20 -left-20 size-64 bg-emerald-300/40 rounded-full blur-[80px] pointer-events-none"></div>
      <div className="absolute top-10 left-10 size-40 bg-emerald-200/50 rounded-full blur-[60px] pointer-events-none"></div>

      {/* Decorative circles - bottom right */}
      <div className="absolute -bottom-20 -right-20 size-72 bg-emerald-300/40 rounded-full blur-[90px] pointer-events-none"></div>
      <div className="absolute bottom-20 right-20 size-48 bg-emerald-200/50 rounded-full blur-[70px] pointer-events-none"></div>

      <div className="max-w-md w-full relative z-10">
        {/* Title */}
        <div className="text-center mb-8">
          <p className="text-slate-600 mb-2">Welcome to</p>
          <h1 className="text-5xl text-emerald-600 mb-8 text-center" style={{ fontFamily: 'Urbanist, sans-serif' }}>
          bin<span className="font-semibold">Go</span>
        </h1>
          <p className="text-slate-600 text-sm">
            How you manage your waste?
            <br />
            If not, then start from now.
          </p>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="name"
            placeholder="dhnaanjay panasare"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-6 py-4 border-2 border-slate-900 rounded-full bg-white text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all"
          />

          <input
            type="email"
            name="email"
            placeholder="dhanajpjay33@gmal'com"
            value={formData.email}
            onChange={handleChange}
            className="w-full px-6 py-4 border-2 border-slate-900 rounded-full bg-white text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all"
          />

          <input
            type="password"
            name="password"
            placeholder="••••••••••g"
            value={formData.password}
            onChange={handleChange}
            className="w-full px-6 py-4 border-2 border-slate-900 rounded-full bg-white text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all"
          />

          <input
            type="password"
            name="confirmPassword"
            placeholder="••••••••••"
            value={formData.confirmPassword}
            onChange={handleChange}
            className="w-full px-6 py-4 border-2 border-slate-900 rounded-full bg-white text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all"
          />

          <input
            type="text"
            name="address"
            placeholder="kurla kamgar nagar"
            value={formData.address}
            onChange={handleChange}
            className="w-full px-6 py-4 border-2 border-slate-900 rounded-full bg-white text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all"
          />

          {/* Terms & Conditions */}
          <div className="flex items-center justify-center gap-2 py-2">
            <input
              type="checkbox"
              name="acceptTerms"
              id="acceptTerms"
              checked={formData.acceptTerms}
              onChange={handleChange}
              className="w-4 h-4 accent-emerald-500 cursor-pointer"
            />
            <label htmlFor="acceptTerms" className="text-sm text-slate-700 cursor-pointer">
              I accept the terms & conditions
            </label>
          </div>

          {/* Register Button */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Register
          </button>

          {/* Sign In Link */}
          <p className="text-center text-sm text-slate-700">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-emerald-500 hover:text-emerald-600 font-semibold transition-colors"
            >
              Sign In
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
