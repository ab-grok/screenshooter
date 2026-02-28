import JSZip from "jszip";
import { formatDate } from "./dateformatter";
import { file } from "./types";

type downloader = {
  download: (file: file | file[]) => Promise<{ error: any }>;
  openInNewTab: (file: file | file[]) => Promise<{ error: any }>;
};

export function useDownloader(): downloader {
  async function download(file: file | file[]) {
    try {
      let name: string;
      let content: Blob;

      if (Array.isArray(file)) {
        const zip = new JSZip();
        file.forEach((f, i) => {
          //Names the zip file as `first shot date - last shot date`.
          i == 0 && (name = formatDate(f.date!));
          i == file.length - 1 && (name += " - " + formatDate(f.date!));

          zip.file(f.fileName, createBlob(f));
        });
        content = await zip.generateAsync({ type: "blob" });
      } else content = createBlob(file);

      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = Array.isArray(file) ? name! : file.fileName;
      a.click();
      URL.revokeObjectURL(url);

      return { error: null };
    } catch (e) {
      //set Error notification;
      console.error("Error downloading file(s):", e);
      return { error: e };
    }
  }

  async function openInNewTab(file: file | file[]) {
    try {
      if (Array.isArray(file)) {
        file.forEach((f) => {
          setTimeout(() => {
            const content = createBlob(f);
            const url = URL.createObjectURL(content);
            window.open(url, "_blank");
          }, 500);
        });
      } else {
        const content = createBlob(file);
        const url = URL.createObjectURL(content);
        window.open(url, "_blank");
      }
      return { error: null };
    } catch (e) {
      //set error notification
      console.error("Error opening file(s): ", e);
      return { error: e };
    }
  }

  return { download, openInNewTab };
}

function createBlob(file: file) {
  const { fileType: type, fileData: data } = file;

  if (typeof data == "string" && type != "text/plain") {
    const buffer = Buffer.from(data, "base64"); //gets array buffer

    return new Blob([buffer], { type });
  } else {
    //assume UintArray or plain text
    return new Blob([data], { type });
  }
}
