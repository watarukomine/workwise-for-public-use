'use server';
import { createEvents, type EventAttributes } from 'ics';
import { URLSearchParams } from 'url';

interface CreateICalLinkArgs {
  title: string;
  description: string;
  start: string; // ISO String
  end: string;   // ISO String
}

export async function createICalLink(args: CreateICalLinkArgs): Promise<string> {
  const { title, description, start, end } = args;

  const startDateTime = new Date(start);
  const endDateTime = new Date(end);

  const event: EventAttributes = {
    start: [startDateTime.getFullYear(), startDateTime.getMonth() + 1, startDateTime.getDate(), startDateTime.getHours(), startDateTime.getMinutes()],
    end: [endDateTime.getFullYear(), endDateTime.getMonth() + 1, endDateTime.getDate(), endDateTime.getHours(), endDateTime.getMinutes()],
    title,
    description,
  };

  return new Promise((resolve, reject) => {
    createEvents([event], (error, value) => {
      if (error) {
        console.error("Error creating iCal event:", error);
        reject(error);
        return;
      }
      
      const mailtoParams = new URLSearchParams({
        subject: `予定: ${title}`,
        body: `
以下の予定をカレンダーに追加してください。

タイトル: ${title}
開始: ${start}
終了: ${end}
詳細:
${description}

---
iCalデータ:
${value}
        `.trim(),
      });
      
      const mailtoLink = `mailto:?${mailtoParams.toString()}`;
      resolve(mailtoLink);
    });
  });
}
