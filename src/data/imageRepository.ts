/** Upload a base64 data URL to Cloudinary, return the public image URL */
export async function uploadProductImage(dataUrl: string): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const form = new FormData();
  form.append("file", dataUrl);
  form.append("upload_preset", uploadPreset);

  let res: Response;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: form,
    });
  } catch {
    // fetch() itself threw — no response at all, almost always a connectivity
    // problem rather than anything Cloudinary rejected.
    throw new Error("ອັບໂຫລດຮູບບໍ່ສຳເລັດ — ກວດສອບການເຊື່ອມຕໍ່ອິນເຕີເນັດ");
  }

  const json = await res.json();
  if (!json.secure_url) {
    // Surface Cloudinary's own reason (e.g. bad preset, file too large,
    // unsupported format) instead of a single generic message for everything.
    throw new Error(
      json.error?.message ? `ອັບໂຫລດຮູບບໍ່ສຳເລັດ: ${json.error.message}` : "ອັບໂຫລດຮູບບໍ່ສຳເລັດ"
    );
  }
  return json.secure_url as string;
}
