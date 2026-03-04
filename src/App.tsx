import { Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import Capture from "./pages/Capture";
import Edit from "./pages/Edit";
import Preview from "./pages/Preview";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/templates" element={<Navigate to="/capture" replace />} />
      <Route path="/capture" element={<Capture />} />
      <Route path="/edit" element={<Edit />} />
      <Route path="/preview" element={<Preview />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
