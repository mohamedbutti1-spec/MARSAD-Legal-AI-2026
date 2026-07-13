import React, { useState, useRef } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useUserContext } from '@/lib/user-context';
import { apiFetch } from '@/lib/api-fetch';
import { Upload, X, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export default function UploadPage() {
  const { canUpload } = useUserContext();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!canUpload) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
          <p className="text-muted-foreground mt-2">You do not have permission to upload documents.</p>
        </div>
      </AppLayout>
    );
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelection = (selectedFile: File) => {
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.pdf') && !selectedFile.name.endsWith('.docx') && !selectedFile.name.endsWith('.txt')) {
      setStatus('error');
      setErrorMessage('Invalid file type. Please upload PDF, DOCX, or TXT.');
      return;
    }
    setFile(selectedFile);
    setStatus('idle');
    setErrorMessage('');
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(10);
    setStatus('idle');

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Simulate progress
      const interval = setInterval(() => {
        setProgress(p => Math.min(p + 15, 90));
      }, 500);

      const res = await apiFetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
        // ⚠️ No Content-Type header here — browser sets it automatically
        //    with the multipart boundary when body is FormData.
      });

      clearInterval(interval);
      setProgress(100);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      setStatus('success');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'An error occurred during upload.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto" dir="auto">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Upload Document <span className="text-muted-foreground font-sans font-normal text-xl ml-2">/ رفع ملف</span></h1>
          <p className="text-muted-foreground mt-2 font-serif">Add new material to the private library for AI processing.</p>
        </div>

        <div 
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/10'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef}
            onChange={(e) => e.target.files && handleFileSelection(e.target.files[0])}
            accept=".pdf,.docx,.txt"
          />
          
          <div className="w-16 h-16 bg-secondary text-secondary-foreground rounded-full flex items-center justify-center mx-auto mb-6">
            <Upload className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">Drag & drop your file here</h3>
          <p className="text-muted-foreground mb-6">Supports PDF, DOCX, and TXT files up to 50MB.</p>
          <Button onClick={() => fileInputRef.current?.click()} variant="outline">
            Browse Files
          </Button>
        </div>

        {file && !uploading && status !== 'success' && (
          <div className="bg-card border rounded-md p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary" />
              <div>
                <p className="font-semibold text-foreground text-sm">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                <X className="w-4 h-4" />
              </Button>
              <Button onClick={handleUpload}>
                Upload Now
              </Button>
            </div>
          </div>
        )}

        {uploading && (
          <div className="bg-card border rounded-md p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">Uploading {file?.name}...</span>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {status === 'success' && (
          <div className="bg-heading/10 dark:bg-heading/30 border border-heading/25 dark:border-heading/85 rounded-md p-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-heading dark:text-heading mx-auto mb-3" />
            <h3 className="text-lg font-bold text-heading/75 dark:text-heading/80 mb-1">Upload Successful</h3>
            <p className="text-heading/80 dark:text-heading/80 mb-4">Your document has been added to the library and is ready for AI processing.</p>
            <Button variant="outline" onClick={() => setStatus('idle')} className="border-heading/40 text-heading hover:bg-heading/15">Upload Another</Button>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-destructive text-sm">Upload Failed</h4>
              <p className="text-sm text-destructive/80 mt-1">{errorMessage}</p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
