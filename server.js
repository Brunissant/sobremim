import express from "express";
import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;
const app = express();
app.set("trust proxy",1);
app.use(express.json({ limit: "15mb" }));
app.use(express.static("public"));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase();
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.createHash("sha256").update(ADMIN_EMAIL || "apolo-admin").digest("hex");

await pool.query(`
  create table if not exists gallery_photos (
    id uuid primary key,
    mime_type text not null,
    image_data bytea not null,
    created_at timestamptz not null default now(),
    hidden boolean not null default false
  );
  create table if not exists admin_credentials (
    email text primary key,
    password_hash text not null,
    created_at timestamptz not null default now()
  );
`);

function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > -1) out[decodeURIComponent(part.slice(0,i).trim())] = decodeURIComponent(part.slice(i+1).trim());
  }
  return out;
}
function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}
function isAdmin(req) {
  const raw = cookies(req).apolo_admin;
  if (!raw) return false;
  const [email, exp, sig] = raw.split("|");
  if (!email || !exp || !sig || Date.now() > Number(exp)) return false;
  const expected = sign(email + "|" + exp);
  try {
    return email === ADMIN_EMAIL && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch { return false; }
}
function adminOnly(req,res,next) {
  if (!isAdmin(req)) return res.status(401).json({error:"Não autorizado"});
  next();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return salt + ":" + hash;
}
function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  try { return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected); }
  catch { return false; }
}
async function adminSetupRequired() {
  if (!ADMIN_EMAIL) return false;
  const { rows } = await pool.query("select 1 from admin_credentials where email=$1",[ADMIN_EMAIL]);
  return rows.length === 0;
}
function setAdminCookie(res,email) {
  const exp = Date.now() + 12*60*60*1000;
  const token = email + "|" + exp + "|" + sign(email + "|" + exp);
  res.setHeader("Set-Cookie", `apolo_admin=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200`);
}

app.get("/api/session",async(req,res)=>res.json({
  admin:isAdmin(req),
  setupRequired: await adminSetupRequired(),
  adminEmail: ADMIN_EMAIL
}));

app.post("/api/setup-admin",async(req,res)=>{
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!ADMIN_EMAIL || email !== ADMIN_EMAIL) return res.status(403).json({error:"Este e-mail não é o administrador configurado"});
  if (password.length < 8) return res.status(400).json({error:"A senha precisa ter pelo menos 8 caracteres"});
  if (!(await adminSetupRequired())) return res.status(409).json({error:"O acesso de administradora já foi criado"});
  await pool.query("insert into admin_credentials(email,password_hash) values($1,$2)",[email,hashPassword(password)]);
  setAdminCookie(res,email);
  res.json({ok:true});
});

app.post("/api/login",async(req,res)=>{
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!ADMIN_EMAIL || email !== ADMIN_EMAIL) return res.status(401).json({error:"E-mail ou senha incorretos"});
  const { rows } = await pool.query("select password_hash from admin_credentials where email=$1",[email]);
  if (!rows[0] || !verifyPassword(password,rows[0].password_hash)) {
    return res.status(401).json({error:"E-mail ou senha incorretos"});
  }
  setAdminCookie(res,email);
  res.json({ok:true});
});

app.post("/api/logout",(req,res)=>{
  res.setHeader("Set-Cookie","apolo_admin=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  res.json({ok:true});
});

app.get("/api/photos",async(req,res)=>{
  const admin = isAdmin(req);
  const sql = admin
    ? "select id,created_at,hidden from gallery_photos order by created_at desc"
    : "select id,created_at,hidden from gallery_photos where hidden=false order by created_at desc";
  const {rows}=await pool.query(sql);
  res.json({photos:rows,admin});
});

app.get("/api/photos/:id/image",async(req,res)=>{
  const {rows}=await pool.query("select mime_type,image_data,hidden from gallery_photos where id=$1",[req.params.id]);
  const row=rows[0];
  if(!row || (row.hidden && !isAdmin(req))) return res.sendStatus(404);
  res.setHeader("Content-Type",row.mime_type);
  res.setHeader("Cache-Control","public,max-age=31536000,immutable");
  res.send(row.image_data);
});

app.post("/api/photos",async(req,res)=>{
  const dataUrl=String(req.body?.dataUrl || "");
  const m=dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if(!m) return res.status(400).json({error:"Imagem inválida"});
  const buf=Buffer.from(m[2],"base64");
  if(buf.length>6*1024*1024) return res.status(413).json({error:"Imagem muito grande"});
  const id=crypto.randomUUID();
  await pool.query("insert into gallery_photos(id,mime_type,image_data) values($1,$2,$3)",[id,m[1],buf]);
  res.json({ok:true,id});
});

app.get("/share/photo/:id",async(req,res)=>{
  const { rows } = await pool.query("select id,hidden from gallery_photos where id=$1",[req.params.id]);
  if(!rows[0] || rows[0].hidden) return res.sendStatus(404);
  const origin = req.protocol + "://" + req.get("host");
  const image = origin + "/api/photos/" + req.params.id + "/image";
  const page = origin + "/share/photo/" + req.params.id;
  res.setHeader("Content-Type","text/html; charset=utf-8");
  res.send(`<!doctype html><html lang="pt-BR"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Safari do Apolo — Memória da Festa</title>
    <meta property="og:title" content="Safari do Apolo — Memória da Festa">
    <meta property="og:description" content="Uma lembrança da primeira volta ao sol do Apolo.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${page}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:secure_url" content="${image}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Safari do Apolo — Memória da Festa">
    <meta name="twitter:image" content="${image}">
    <meta http-equiv="refresh" content="0;url=/">
  </head><body></body></html>`);
});

app.patch("/api/photos/:id",adminOnly,async(req,res)=>{
  await pool.query("update gallery_photos set hidden=$1 where id=$2",[!!req.body?.hidden,req.params.id]);
  res.json({ok:true});
});

app.delete("/api/photos/:id",adminOnly,async(req,res)=>{
  await pool.query("delete from gallery_photos where id=$1",[req.params.id]);
  res.json({ok:true});
});

const ASSET_NAMES = new Set([
  "apolo-lettering.png","apolo-rosto-centralizado.png","safari-frame-turma-v2.png",
  "moldura-jipe-macaco-apolo-v3.png","moldura-girafa-aquarela.png",
  "moldura-elefante-aquarela.png","moldura-leao-turma-v2.png",
  "moldura-leao-turma-direita-v2.png","moldura-turma-apolo-completa.png"
]);
app.get("/assets/:name",async(req,res)=>{
  if(!ASSET_NAMES.has(req.params.name)) return res.sendStatus(404);
  const remote="https://safari-do-apolo-memorias.lasantcompras.chatgpt.site/"+req.params.name;
  const r=await fetch(remote);
  if(!r.ok) return res.sendStatus(404);
  const buf=Buffer.from(await r.arrayBuffer());
  res.setHeader("Content-Type",r.headers.get("content-type")||"image/png");
  res.setHeader("Cache-Control","public,max-age=86400");
  res.send(buf);
});

app.get("/health",(req,res)=>res.json({ok:true}));
app.get("/*splat",(req,res)=>res.sendFile(process.cwd()+"/public/index.html"));

const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log("Safari do Apolo online na porta",port));
