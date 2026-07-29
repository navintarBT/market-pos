/** Upload a base64 data URL to Cloudinary, return the public image URL */
export async function uploadProductImage(dataUrl: string): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const form = new FormData();
  form.append("file", dataUrl);
  form.append("upload_preset", uploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });

  const json = await res.json();
  if (!json.secure_url) throw new Error("ອັບໂຫລດຮູບບໍ່ສຳເລັດ");
  return json.secure_url as string;
}
