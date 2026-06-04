/** Upload a base64 data URL to imgBB, return the public image URL */
export async function uploadProductImage(dataUrl: string): Promise<string> {
  const base64 = dataUrl.split(",")[1];

  const form = new FormData();
  form.append("key", import.meta.env.VITE_IMGBB_API_KEY);
  form.append("image", base64);

  const res = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: form,
  });

  const json = await res.json();
  if (!json.success) throw new Error("ອັບໂຫລດຮູບບໍ່ສຳເລັດ");
  return json.data.display_url as string;
}
