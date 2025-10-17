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
            <div className="bg-rt-sidebar rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
                {/* Modal Header */}
                <div className="px-6 py-5 border-b border-rt-card flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Files History</h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-rt-card hover:bg-rt-card/80 flex items-center justify-center text-white text-xl transition-colors"
                    >
                        ×
                    </button>
                </div>

                {/* Files List */}
                <div className="p-6 max-h-96 overflow-y-auto">
                    {files.length === 0 ? (
                        <p className="text-rt-text-light text-center py-8">No files yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {files.map((f, i) => (
                                <div key={i} className="bg-rt-card rounded-xl p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="text-white text-sm font-medium mb-1 break-all">
                                                {f.filename}
                                            </div>
                                            <div className="text-rt-text-gray text-xs">
                                                {f.sender ? `From ${f.sender}` : ""}
                                                {f.sender && " • "}
                                                {(f.blob.size / 1024 / 1024).toFixed(1)} MB
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDownload(f)}
                                            className="bg-rt-green-dark hover:bg-rt-green text-white px-3 py-2 rounded-lg font-medium text-sm transition-colors ml-3 flex-shrink-0"
                                        >
                                            ↓
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
