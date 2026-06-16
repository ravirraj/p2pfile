export async function saveFile(blob, fileName) {
  try {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({ suggestedName: fileName });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    }
  } catch (err) {
    if (err.name === "AbortError") return;
  }

  try {
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName)] })) {
      await navigator.share({ files: [new File([blob], fileName)] });
      return;
    }
  } catch {}

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
