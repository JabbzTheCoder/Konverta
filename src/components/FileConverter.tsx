'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

type ConversionStatus = 'pending' | 'converting' | 'done' | 'error';

interface FileItem {
  id: string;
  file: File;
  status: ConversionStatus;
  progress: number;
  outputBlob?: Blob;
  errorMsg?: string;
}

export default function FileConverter() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const isInitializing = useRef(false);
  
  // Load ffmpeg
  useEffect(() => {
    const load = async () => {
      if (isLoaded || isInitializing.current) return;
      isInitializing.current = true;
      try {
        const ffmpeg = new FFmpeg();
        ffmpegRef.current = ffmpeg;
        
        ffmpeg.on('log', ({ message }) => {
          console.log(message);
        });

        await ffmpeg.load({
          coreURL: await toBlobURL(`/ffmpeg/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`/ffmpeg/ffmpeg-core.wasm`, 'application/wasm'),
        });
        
        setIsLoaded(true);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load ffmpeg:', err);
        setIsLoading(false);
        isInitializing.current = false;
      }
    };
    
    load();
  }, [isLoaded]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(e.target.files);
    }
  };

  const handleFilesSelected = (fileList: FileList) => {
    const newFiles: FileItem[] = Array.from(fileList)
      .filter(f => f.type === 'video/mp4' || f.name.toLowerCase().endsWith('.mp4'))
      .map(f => ({
        id: Math.random().toString(36).substring(7),
        file: f,
        status: 'pending',
        progress: 0,
      }));
    
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const downloadFile = (fileItem: FileItem) => {
    if (!fileItem.outputBlob) return;
    const url = URL.createObjectURL(fileItem.outputBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileItem.file.name.replace(/\.mp4$/i, '.mp3');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const convertFile = async (fileItem: FileItem) => {
    if (!ffmpegRef.current || !isLoaded) return;
    const ffmpeg = ffmpegRef.current;

    setFiles(prev => prev.map(f => 
      f.id === fileItem.id ? { ...f, status: 'converting', progress: 0 } : f
    ));

    const inputName = `input_${fileItem.id}.mp4`;
    const outputName = `output_${fileItem.id}.mp3`;

    try {
      // Setup progress handler specific to this file
      const onProgress = ({ progress }: { progress: number }) => {
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { ...f, progress: Math.max(0, Math.min(100, progress * 100)) } : f
        ));
      };
      ffmpeg.on('progress', onProgress);

      await ffmpeg.writeFile(inputName, await fetchFile(fileItem.file));
      
      // Convert to mp3
      await ffmpeg.exec(['-i', inputName, '-q:a', '0', '-map', 'a', outputName]);
      
      const fileData = await ffmpeg.readFile(outputName);
      const data = fileData as any;
      const outputBlob = new Blob([data], { type: 'audio/mpeg' });

      setFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { ...f, status: 'done', progress: 100, outputBlob } : f
      ));

      // Cleanup
      ffmpeg.off('progress', onProgress);
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
      
    } catch (err: any) {
      console.error(err);
      setFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { ...f, status: 'error', errorMsg: err.message } : f
      ));
    }
  };

  const convertAll = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'error');
    // We convert them sequentially to not overload the WASM memory
    for (const file of pendingFiles) {
      await convertFile(file);
    }
  };

  if (isLoading) {
    return (
      <div className="ffmpeg-loading">
        <div className="spinner"></div>
        <p>Loading Conversion Engine...</p>
      </div>
    );
  }

  if (!isLoaded && !isLoading) {
    return (
      <div className="ffmpeg-loading" style={{ color: 'var(--danger-color)' }}>
        <p>Failed to load the conversion engine. Please check your connection or try again later.</p>
      </div>
    );
  }

  return (
    <div>
      <div 
        className={`upload-zone ${isDragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          className="file-input" 
          accept="video/mp4" 
          multiple 
          onChange={handleFileChange}
        />
        <svg className="upload-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <h3 className="upload-title">Drag & Drop your MP4 files here</h3>
        <p className="upload-desc">or click to browse from your device</p>
      </div>

      {files.length > 0 && (
        <div className="file-list">
          {files.map(file => (
            <div key={file.id} className="file-item">
              <div className="file-info">
                <svg className="file-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <div className="file-details">
                  <div className="file-name">{file.file.name}</div>
                  <div className="file-meta">
                    <span className={`status-badge status-${file.status}`}>
                      {file.status}
                    </span>
                    <span>{(file.file.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                  {(file.status === 'converting' || file.progress > 0) && (
                    <div className="progress-container">
                      <div className="progress-bar" style={{ width: `${file.progress}%` }}></div>
                    </div>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {file.status === 'done' && (
                  <button className="btn-icon download" onClick={() => downloadFile(file)} title="Download MP3">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                )}
                {file.status !== 'converting' && (
                  <button className="btn-icon remove" onClick={() => removeFile(file.id)} title="Remove file">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="actions">
          <button 
            className="btn btn-secondary" 
            onClick={() => setFiles([])}
            disabled={files.some(f => f.status === 'converting')}
          >
            Clear All
          </button>
          <button 
            className="btn btn-primary"
            onClick={convertAll}
            disabled={!files.some(f => f.status === 'pending' || f.status === 'error') || files.some(f => f.status === 'converting')}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Convert Files
          </button>
        </div>
      )}
    </div>
  );
}
