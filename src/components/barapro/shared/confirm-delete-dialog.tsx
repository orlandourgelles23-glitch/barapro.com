'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDeleteDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void;
  /** What is being deleted (e.g., "este elemento") */
  itemName?: string;
  /** Confirmation callback */
  onConfirm: () => void;
  /** Optional additional warning text */
  warning?: string;
}

/**
 * Standardized delete confirmation dialog.
 * Professional dialog with danger theme, clear warning icon,
 * and properly styled Cancel + Delete buttons.
 *
 * @example
 * <ConfirmDeleteDialog
 *   open={deleteOpen}
 *   onOpenChange={setDeleteOpen}
 *   itemName="este gasto de capital"
 *   onConfirm={() => handleDelete()}
 * />
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  itemName,
  onConfirm,
  warning,
}: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="glass-card border-danger/20 shadow-card-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg shrink-0"
              style={{
                background:
                  'radial-gradient(circle, oklch(0.58 0.22 25 / 0.18) 0%, oklch(0.58 0.22 25 / 0.06) 70%, transparent 100%)',
              }}
            >
              <AlertTriangle className="h-5 w-5 text-danger" />
            </div>
            <AlertDialogTitle className="text-fin-xl text-foreground">
              {'Eliminar elemento'}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-fin-sm text-muted-foreground pl-[52px]">
            {itemName
              ? `¿Está seguro de que desea eliminar ${itemName}? Esta acción no se puede deshacer.`
              : '¿Está seguro de que desea eliminar este elemento? Esta acción no se puede deshacer.'}
            {warning && (
              <span className="block mt-2 text-fin-xs font-medium text-danger bg-danger-muted/50 rounded-md px-2.5 py-1.5">
                {warning}
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="focus-ring">
            {'Cancelar'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-danger text-danger-foreground hover:bg-danger/90 focus-ring-danger"
          >
            {'Eliminar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
