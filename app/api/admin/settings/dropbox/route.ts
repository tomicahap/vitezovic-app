import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { getDropboxAccessToken } from '@/lib/backup';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dropboxAppKey, dropboxAppSecret, dropboxRefreshToken, dropboxFolderPath, action } = body;

    if (action === 'test') {
      try {
        console.log('[Dropbox API] Testing connection...');
        const token = await getDropboxAccessToken(dropboxAppKey, dropboxAppSecret, dropboxRefreshToken);
        
        // Upload a tiny test file to Dropbox to confirm write access
        const cleanFolder = dropboxFolderPath.startsWith('/') ? dropboxFolderPath : `/${dropboxFolderPath}`;
        const cleanFolderNoTrailing = cleanFolder.endsWith('/') && cleanFolder.length > 1 ? cleanFolder.slice(0, -1) : cleanFolder;
        const dropboxDestPath = cleanFolderNoTrailing === '/' ? '/test_connection.txt' : `${cleanFolderNoTrailing}/test_connection.txt`;

        const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Dropbox-API-Arg': JSON.stringify({
              path: dropboxDestPath,
              mode: 'overwrite',
              mute: true,
            }),
            'Content-Type': 'application/octet-stream',
          },
          body: 'Dropbox connection test was successful!',
        });

        if (response.ok) {
          return NextResponse.json({ success: true, message: 'Veza s Dropboxom je uspješno uspostavljena i testna datoteka je stvorena!' });
        } else {
          const errText = await response.text();
          return NextResponse.json({ success: false, error: `Dropbox API greška: ${errText}` }, { status: 400 });
        }
      } catch (err: any) {
        return NextResponse.json({ success: false, error: `Greška pri autorizaciji: ${err.message}` }, { status: 400 });
      }
    }

    // Save Settings
    DatabaseService.updateSettings({
      dropboxAppKey: dropboxAppKey?.trim() || null,
      dropboxAppSecret: dropboxAppSecret?.trim() || null,
      dropboxRefreshToken: dropboxRefreshToken?.trim() || null,
      dropboxFolderPath: dropboxFolderPath?.trim() || null,
    });

    return NextResponse.json({ success: true, message: 'Dropbox postavke su uspješno spremljene.' });
  } catch (error: any) {
    console.error('Error in dropbox settings API:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
