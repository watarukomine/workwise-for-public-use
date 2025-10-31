
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { ScheduleEvent, Staff, WithId } from '@/lib/types';
import { updateSheetStatus } from '@/app/actions/update-sheet-status';
import { ORDER_GAS_URL, STATUS_COLUMN_NAME } from '@/lib/settings';


const STATUS_OPTIONS = [
  { value: '予約中', label: '予約中' },
  { value: '進行中', label: '進行中' },
  { value: '完了', label: '完了' },
  { value: 'キャンセル', label: 'キャンセル' },
];

interface TaskAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEvent: ScheduleEvent | null;
  staffList: WithId<Staff>[];
  onEventUpdated: (updatedEvent: ScheduleEvent) => void;
}

export function TaskAssignmentDialog({
  isOpen,
  onClose,
  selectedEvent,
  staffList,
  onEventUpdated
}: TaskAssignmentDialogProps) {
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // イベントが選択されたとき、担当者を初期設定
  useEffect(() => {
    if (selectedEvent) {
      setSelectedStaff(selectedEvent.staffName || null);
      setSelectedStatus(selectedEvent.status || null);
    }
  }, [selectedEvent]);

  // ダイアログを閉じるときに状態をリセット
  const handleClose = () => {
    setSelectedStaff(null);
    setSelectedStatus(null);
    onClose();
  };

  const handleAssign = async () => {
    if (!selectedEvent) return;
    
    setIsSubmitting(true);
    
    try {
      // スプレッドシートを更新
      const updateResult = await updateSheetStatus({
        gasUrl: ORDER_GAS_URL,
        eventTitle: selectedEvent.title,
        staffName: selectedStaff,
        statusValue: selectedStatus,
        timestamp: new Date().toISOString()
      });
      
      if (updateResult.status === 'error') {
        throw new Error(updateResult.message);
      }

      // 説明テキストを更新
      let newDescription = selectedEvent.description || '';
      
      // 担当者の行を更新または追加
      if (selectedStaff) {
        if (newDescription.includes('担当:')) {
          newDescription = newDescription.replace(/担当: .*/, `担当: ${selectedStaff}`);
        } else {
          newDescription += `\n担当: ${selectedStaff}`;
        }
      } else {
        // 担当者が選択されていない場合、その行を削除
        newDescription = newDescription.replace(/\n?担当: .*/, '');
      }
      
      // ステータスの行を更新または追加
      if (selectedStatus) {
        if (newDescription.includes('ステータス:')) {
          newDescription = newDescription.replace(/ステータス: .*/, `ステータス: ${selectedStatus}`);
        } else {
          newDescription += `\nステータス: ${selectedStatus}`;
        }
      } else {
        // ステータスが選択されていない場合、その行を削除
        newDescription = newDescription.replace(/\n?ステータス: .*/, '');
      }
      
      // 前後の余分な改行を削除
      newDescription = newDescription.trim();
      
      // イベント情報を更新
      const updatedEvent: ScheduleEvent = {
        ...selectedEvent,
        description: newDescription,
        staffName: selectedStaff || undefined,
        status: selectedStatus || undefined
      };
      
      onEventUpdated(updatedEvent);
      
      toast({
        title: "更新しました",
        description: `${selectedStaff ? `${selectedStaff}さんに` : "担当者なしに"}設定しました。`,
      });
      
      handleClose();
      
    } catch (error: any) {
      console.error('Failed to assign staff:', error);
      toast({
        title: "エラーが発生しました",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const staffOptions = staffList.map(staff => ({
    value: staff.name,
    label: staff.name
  }));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>担当者とステータスの割り当て</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="event-title" className="font-bold">
              イベント
            </Label>
            <p id="event-title" className="text-sm">
              {selectedEvent?.title}
            </p>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="staff-select" className="font-bold">
              担当者
            </Label>
            <Select
              value={selectedStaff || ''}
              onValueChange={setSelectedStaff}
            >
              <SelectTrigger id="staff-select">
                <SelectValue placeholder="担当者を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">担当者なし</SelectItem>
                {staffOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="status-select" className="font-bold">
              {STATUS_COLUMN_NAME}
            </Label>
            <Select
              value={selectedStatus || ''}
              onValueChange={setSelectedStatus}
            >
              <SelectTrigger id="status-select">
                <SelectValue placeholder="ステータスを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">ステータスなし</SelectItem>
                {STATUS_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            キャンセル
          </Button>
          <Button onClick={handleAssign} disabled={isSubmitting}>
            {isSubmitting ? '更新中...' : '更新する'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
