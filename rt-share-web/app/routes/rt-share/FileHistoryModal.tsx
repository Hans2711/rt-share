import React from "react";

interface FileEntry {
    filename: string;
    blob: Blob;
    sender?: string;
}

interface FileHistoryModalProps {
    files: FileEntry[];
    onClose: () => void;
}

export function FileHistoryModal({ files, onClose }: FileHistoryModalProps) {
    const handleDownload = (f: FileEntry) => {
        const url = URL.createObjectURL(f.blob);
        const a = Object.assign(document.createElement("a"), {
            href: url,
            download: f.filename,
            style: "display:none",
        });
        document.body.appendChild(a).click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded shadow w-full max-w-sm max-h-full overflow-y-auto p-4">
                <h2 className="text-lg font-bold mb-2">Received Files</h2>
                {files.length === 0 ? (
                    <p className="text-sm">No files yet.</p>
                ) : (
                    <ul className="divide-y divide-gray-300 dark:divide-gray-700">
                        {files.map((f, i) => (
                            <li key={i} className="py-2 flex items-center justify-between gap-2">
                                <span className="text-sm break-all flex-1">
                                    {f.sender ? `${f.sender}: ` : ""}{f.filename}
                                </span>
                                <button
                                    onClick={() => handleDownload(f)}
                                    className="px-2 py-1 text-xs bg-green-500 text-white rounded"
                                >
                                    Download
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                <button
                    onClick={onClose}
                    className="mt-4 w-full px-3 py-2 text-sm bg-gray-200 rounded dark:bg-gray-700 dark:text-gray-200"
                >
                    Close
                </button>
            </div>
        </div>
    );
}
