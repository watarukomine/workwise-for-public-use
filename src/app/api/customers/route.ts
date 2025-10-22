
import { NextResponse } from 'next/server';

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbyC-It_NusXHTNZO9HjP2AZUWQSNj_VeUJCmbvSnyPVzMsUJ-Ytt_CY5WO7DXyobdVzHg/exec';

// Re-validate every 60 seconds
export const revalidate = 60;

export async function GET() {
  try {
    const response = await fetch(GAS_API_URL, {
        next: {
            revalidate: 60 // Re-fetch data every 60 seconds
        }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GAS Fetch Error:', errorText);
      return NextResponse.json({ error: true, message: `GASからのデータ取得に失敗しました。ステータス: ${response.status}` }, { status: 500 });
    }

    const data = await response.json();

    // The GAS script might return an object with an error property
    if (data.error) {
        console.error('GAS Script Error:', data.message);
        return NextResponse.json({ error: true, message: data.message }, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('API Route Error:', error);
    if (error instanceof Error) {
        return NextResponse.json({ error: true, message: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: true, message: '不明なエラーが発生しました。' }, { status: 500 });
  }
}
