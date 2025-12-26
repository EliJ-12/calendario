import { useAuth } from "@/hooks/use-auth";
import { useAbsences, useCreateAbsence, useUpdateAbsence, useDeleteAbsence } from "@/hooks/use-absences";
import Layout from "@/components/layout";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { format } from "date-fns";
import { Plus, FileUp, Pencil, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import SupabaseStorage from "@/components/supabase-storage";

export default function EmployeeAbsences() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isPartial, setIsPartial] = useState(false);
  const [partialHours, setPartialHours] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("13:00");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: absences } = useAbsences({ userId: user?.id });
  const createAbsence = useCreateAbsence();
  const updateAbsence = useUpdateAbsence();
  const deleteAbsence = useDeleteAbsence();

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const result = await response.json();
      setFileUrl(result.fileUrl);
      setUploadedFile(file);
    } catch (error) {
      console.error('Upload error:', error);
      // Handle error appropriately
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleEdit = (absence: any) => {
    setEditingId(absence.id);
    setStartDate(absence.startDate);
    setEndDate(absence.endDate);
    setReason(absence.reason);
    setIsPartial(absence.isPartial);
    setPartialHours(absence.partialHours?.toString() || "");
    setStartTime("09:00");
    setEndTime("13:00");
    setFileUrl(absence.fileUrl || "");
    setOpen(true);
  };

  const handleDelete = async (id: number) => {
    await deleteAbsence.mutateAsync(id);
  };

  const resetForm = () => {
    setStartDate("");
    setEndDate("");
    setReason("");
    setIsPartial(false);
    setPartialHours("");
    setStartTime("09:00");
    setEndTime("13:00");
    setUploadedFile(null);
    setFileUrl("");
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || isSubmitting) return;

    setIsSubmitting(true);
    
    try {
      const data = {
        userId: user.id,
        startDate,
        endDate: isPartial ? startDate : endDate,
        reason,
        status: "pending" as const,
        isPartial,
        partialHours: isPartial ? (startTime && endTime ? 
          (() => {
            const [sH, sM] = startTime.split(':').map(Number);
            const [eH, eM] = endTime.split(':').map(Number);
            return (eH * 60 + eM) - (sH * 60 + sM);
          })() : null) : null,
        fileUrl: fileUrl || null 
      };

      if (editingId) {
        await updateAbsence.mutateAsync({ id: editingId, ...data });
      } else {
        await createAbsence.mutateAsync(data);
      }
      
      setOpen(false);
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mis Ausencias</h1>
            <p className="text-muted-foreground">Justifica tus ausencias y consulta el estado</p>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Justificar Ausencia
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Ausencia" : "Registrar Ausencia"}</DialogTitle>
                <DialogDescription>Indica el motivo y horario de tu ausencia.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="flex items-center space-x-2 pb-2 border-b">
                  <Switch id="partial" checked={isPartial} onCheckedChange={setIsPartial} />
                  <Label htmlFor="partial">Ausencia Parcial (Unas horas)</Label>
                </div>

                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                </div>

                {!isPartial ? (
                  <div className="space-y-2">
                    <Label>Hasta Fecha (opcional)</Label>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Hora Inicio</Label>
                      <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Hora Fin</Label>
                      <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Adjuntar Documento (Opcional)</Label>
                  <div className="border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.gif,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-upload"
                      disabled={isUploading}
                    />
                    <label 
                      htmlFor="file-upload" 
                      className="cursor-pointer flex flex-col items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isUploading ? (
                        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mb-2"></div>
                      ) : (
                        <FileUp className="h-6 w-6 mb-2" />
                      )}
                      <span className="text-xs">
                        {isUploading ? 'Subiendo...' : uploadedFile ? uploadedFile.name : 'Haz clic o arrastra un archivo'}
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">
                        PDF, JPG, PNG, GIF (máx. 5MB)
                      </span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Motivo</Label>
                  <Textarea value={reason} onChange={e => setReason(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting || isUploading}>
                  {isSubmitting ? "Enviando..." : "Enviar Registro"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* File Storage Section */}
        <SupabaseStorage userId={user?.id} isAdmin={false} />

        <div className="rounded-md border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr className="text-left">
                  <th className="p-4">Fechas</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Motivo</th>
                  <th className="p-4">Documento</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {absences?.map((absence) => (
                  <tr key={absence.id} className="border-b last:border-0">
                    <td className="p-4">
                      {format(new Date(absence.startDate), 'dd/MM/yyyy')} 
                      {absence.startDate !== absence.endDate && ` - ${format(new Date(absence.endDate), 'dd/MM/yyyy')}`}
                    </td>
                    <td className="p-4">{absence.isPartial ? `${absence.partialHours ? absence.partialHours/60 : 0}h parcial` : 'Jornada completa'}</td>
                    <td className="p-4 max-w-xs truncate">{absence.reason}</td>
                    <td className="p-4">
                      {absence.fileUrl ? (
                        <a 
                          href={absence.fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                        >
                          <FileUp className="h-4 w-4" />
                          Ver documento
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-4"><StatusBadge status={absence.status || "pending"} /></td>
                    <td className="p-4 flex gap-1">
                      {absence.status === 'pending' && (
                        <>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8" 
                            onClick={() => handleEdit(absence)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-red-600" 
                            onClick={() => handleDelete(absence.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
