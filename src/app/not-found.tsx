import Link from "next/link";

export default function NotFound() {
  return (
    <main className="home">
      <div className="home-card">
        <h1>Không tìm thấy</h1>
        <p>QR hết hạn hoặc đường dẫn sai.</p>
        <Link className="btn" href="/">
          Về trang chủ
        </Link>
      </div>
    </main>
  );
}
