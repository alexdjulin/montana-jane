import Link from "next/link";
import { history } from "@/app/lib/assets";

/**
 * Everything this app has generated, newest first, with the prompt behind it.
 * Exists so a run can be reviewed after the fact instead of from memory.
 */
export const dynamic = "force-dynamic";

export default async function Gallery() {
  const rows = await history();

  return (
    <main className="wrap">
      <div className="bar">
        <h1 className="title">Generated · {rows.length}</h1>
        <Link className="pill" href="/">
          ← back to the scene
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="empty-note">
          Nothing generated yet. Start a scene, then come back.
        </p>
      ) : (
        <ul className="gallery">
          {rows.map((r) => (
            <li key={`${r.file}-${r.at}`}>
              <a href={r.file} target="_blank" rel="noreferrer">
                {r.file.match(/\.(mp4|webm)$/i) ? (
                  <video src={r.file} muted loop playsInline autoPlay />
                ) : (
                  <img src={r.file} alt="" />
                )}
              </a>
              <div className="meta">
                <span className="kind">{r.kind}</span>
                <time>{new Date(r.at).toLocaleString()}</time>
                <span className="model">{r.model}</span>
              </div>
              <p className="prompt">{r.prompt}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
