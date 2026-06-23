import { Routes, Route } from "react-router";
import { Navigation } from "@/components/Navigation";
import { Home } from "@/pages/Home";
import { SearchPage } from "@/pages/Search";
import { ProductDetail } from "@/pages/ProductDetail";

function App() {
  return (
    <div className="min-h-screen bg-[#050505]">
      <Navigation />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/product/:id" element={<ProductDetail />} />
      </Routes>
    </div>
  );
}

export default App;
