import Link from "next/link";

export default function Home() {
  return (
    <main className="home">
      <div className="home-card">
        <p className="muted" style={{ color: "#8a7468", letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 12 }}>
          Nền tảng order đa quán
        </p>
        <h1>Gọi món tại bàn.</h1>
        <p>Khách quét QR. Nhân viên chạy ca theo vai trò. Mỗi quán một bộ nhận diện riêng.</p>
        <Link className="btn" href="/t/t9-tu-do">
          Khách · Bàn T9 Quán Tự Do
        </Link>
        <Link className="btn ghost" href="/staff">
          Nhân viên · Vào ca
        </Link>
      </div>
    </main>
  );
}
