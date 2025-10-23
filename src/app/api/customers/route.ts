
import { NextResponse } from 'next/server';

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbyC-It_NusXHTNZO9HjP2AZUWQSNj_VeUJCmbvSnyPVzMsUJ-Ytt_CY5WO7DXyobdVzHg/exec';

// Re-validate every 60 seconds
export const revalidate = 60;

export async function GET() {
  try {
    const response = await fetch(GAS_API_URL, {
      redirect: 'follow', // Explicitly follow redirects
      next: {
          revalidate: 60 // Re-fetch data every 60 seconds
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GAS Fetch Error Response Text:', errorText);
      return NextResponse.json({ error: true, message: `GASからのデータ取得に失敗しました。ステータス: ${response.status}` }, { status: response.status });
    }
    
    // Check content type before parsing
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        const responseText = await response.text();
        console.error("Expected JSON, but received HTML/Text from GAS:", responseText);
        return NextResponse.json({ error: true, message: 'GASから予期しない形式の応答がありました。GASのアクセス権限を確認してください。' }, { status: 500 });
    }

    const data = await response.json();

    // The GAS script might return an object with an error property
    if (data && data.error) {
        console.error('GAS Script Error:', data.message);
        return NextResponse.json({ error: true, message: data.message }, { status: 500 });
    }

    // Ensure we always return an array, even if GAS returns nothing or a single object
    return NextResponse.json(Array.isArray(data) ? data : []);

  } catch (error) {
    console.error('API Route Error:', error);
    if (error instanceof Error) {
        return NextResponse.json({ error: true, message: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: true, message: '不明なエラーが発生しました。' }, { status: 500 });
  }
}
