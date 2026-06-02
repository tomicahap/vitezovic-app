import { NextRequest, NextResponse } from 'next/server';
import { runBackup } from '@/lib/backup';

export async function POST(request: NextRequest) {
  try {
    console.log('[API Backup] Triggering manual backup...');
    const result = await runBackup();
    
    if (result.success) {
      return NextResponse.json({ success: true, message: result.message });
    } else {
      return NextResponse.json({ success: false, error: result.message }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in manual backup API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
