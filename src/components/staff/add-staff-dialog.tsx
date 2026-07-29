'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus, Loader2 } from 'lucide-react';
import { StaffService } from '@/services/staff-service';
import { useToast } from '@/hooks/use-toast';

const AREA_OPTIONS = ['県東', '県央', '県西'];
const STORE_OPTIONS = ['横浜店', '横須賀店', '東名川崎店', '相模原店', '厚木店', '綾瀬店', '小田原店'];
const ROLE_OPTIONS = [
  { value: 'staff', label: 'staff (スタッフ)' },
  { value: 'admin/staff', label: 'admin/staff (管理者・スタッフ兼任)' },
  { value: 'admin', label: 'admin (管理者)' },
  { value: 'controller', label: 'controller (コントローラー)' },
];

export function AddStaffDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [area, setArea] = useState('県東');
  const [mainStore, setMainStore] = useState('横浜店');
  const [color, setColor] = useState('#3B82F6');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: '入力エラー',
        description: '氏名を入力してください。',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const newId = await StaffService.createStaff({
        name: name.trim(),
        email: email.trim() || undefined,
        role: role as any,
        area: area as any,
        '母店': mainStore,
        color,
      });

      toast({
        title: '登録完了',
        description: `スタッフ「${name}」をID「${newId}」として登録しました。`,
      });

      // Reset form
      setName('');
      setEmail('');
      setRole('staff');
      setOpen(false);
      if (onCreated) onCreated();
    } catch (err: any) {
      console.error('Failed to create staff:', err);
      toast({
        title: '登録失敗',
        description: err.message || 'スタッフの登録に失敗しました。',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2 shadow-sm">
          <UserPlus className="h-4 w-4" />
          新規スタッフ追加
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              新規スタッフの登録
            </DialogTitle>
            <DialogDescription>
              Firestoreデータベースに新規スタッフ情報を直接追加します。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right font-medium">
                氏名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 山田 太郎"
                className="col-span-3"
                required
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                メール
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="任意（メールアドレス）"
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                ロール
              </Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="ロールを選択" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="mainStore" className="text-right">
                母店
              </Label>
              <Select value={mainStore} onValueChange={setMainStore}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="母店を選択" />
                </SelectTrigger>
                <SelectContent>
                  {STORE_OPTIONS.map((store) => (
                    <SelectItem key={store} value={store}>
                      {store}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="area" className="text-right">
                エリア
              </Label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="エリアを選択" />
                </SelectTrigger>
                <SelectContent>
                  {AREA_OPTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="color" className="text-right">
                識別カラー
              </Label>
              <div className="col-span-3 flex items-center gap-3">
                <Input
                  id="color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-16 p-0 border cursor-pointer"
                />
                <span className="text-xs font-mono text-muted-foreground">{color}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              保存する
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
