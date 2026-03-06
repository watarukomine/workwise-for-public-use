'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Share2, Copy, Mail, MessageSquare, Check, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export function ShareOrderFormModal({ variant = 'default' }: { variant?: 'default' | 'icon' }) {
    const [url, setUrl] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setUrl(`${window.location.origin}/order-form`);
        }
    }, []);

    const handleShare = async () => {
        // Try Web Share API first
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'タイヤ作業 ご注文フォーム',
                    text: '以下のリンクからご注文をお願いします。',
                    url: url,
                });
                return;
            } catch (err) {
                // If user cancels or API fails (e.g. desktop sometimes), open modal
                // However, user cancellation shouldn't necessarily trigger modal if they just closed the share sheet.
                // But usually safe to fall back if logic is simple. 
                // Let's just open modal if we think it failed for checking.
                // Actually, AbortError is common on cancel.
                if ((err as Error).name !== 'AbortError') {
                    setIsOpen(true);
                }
            }
        } else {
            setIsOpen(true);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({
            title: "リンクをコピーしました",
        });
    };

    const openOrderForm = () => {
        window.open('/order-form', '_blank');
    };

    return (
        <div className="flex items-center gap-2">
            {variant === 'default' && (
                <Button variant="outline" size="sm" onClick={openOrderForm} className="hidden sm:flex">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    フォームを開く
                </Button>
            )}

            {variant === 'default' ? (
                <Button variant="outline" size="sm" onClick={handleShare}>
                    <Share2 className="mr-2 h-4 w-4" />
                    共有
                </Button>
            ) : (
                <Button variant="ghost" size="icon" onClick={handleShare}>
                    <Share2 className="h-4 w-4" />
                </Button>
            )}

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent
                    className="sm:max-w-md"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                            e.preventDefault();
                        }
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>注文フォームを共有</DialogTitle>
                        <DialogDescription>
                            お客様に送信するリンクを選択してください。
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex items-center space-x-2 mt-2">
                        <div className="grid flex-1 gap-2">
                            <Label htmlFor="link" className="sr-only">
                                Link
                            </Label>
                            <Input
                                id="link"
                                defaultValue={url}
                                readOnly
                                className="h-9"
                            />
                        </div>
                        <Button type="submit" size="sm" className="px-3" onClick={handleCopy}>
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            <span className="sr-only">Copy</span>
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-4">
                        <Button variant="outline" className="flex flex-col h-auto py-4 gap-2" asChild>
                            <a href={`mailto:?subject=タイヤ作業 ご注文フォーム&body=以下のリンクからご注文をお願いします。%0D%0A${url}`}>
                                <Mail className="h-6 w-6" />
                                <span>メールで送信</span>
                            </a>
                        </Button>
                        <Button variant="outline" className="flex flex-col h-auto py-4 gap-2" asChild>
                            <a href={`sms:?body=タイヤ作業 ご注文フォーム: ${url}`}>
                                <MessageSquare className="h-6 w-6" />
                                <span>SMSで送信</span>
                            </a>
                        </Button>
                    </div>

                </DialogContent>
            </Dialog>
        </div>
    );
}
