package ro.dispecerat.flota;

import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new ExportBridge(), "AndroidExport");
        }
    }

    private class ExportBridge {
        @JavascriptInterface
        public void saveAndOpenFile(String base64Data, String fileName, String mimeType) {
            if (base64Data == null || base64Data.isEmpty()) {
                return;
            }

            String cleanName = (fileName == null ? "" : fileName)
                .replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_")
                .trim();
            if (cleanName.isEmpty()) {
                cleanName = "raport";
            }

            String resolvedMime = (mimeType == null ? "" : mimeType)
                .split(";")[0]
                .trim()
                .toLowerCase();
            if (cleanName.toLowerCase().endsWith(".pdf")) {
                resolvedMime = "application/pdf";
            } else if (cleanName.toLowerCase().endsWith(".csv")) {
                resolvedMime = "text/csv";
            } else if (resolvedMime.isEmpty()) {
                resolvedMime = "application/octet-stream";
            }

            try {
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);

                File exportsDir = new File(getCacheDir(), "exports");
                if (!exportsDir.exists()) {
                    exportsDir.mkdirs();
                }
                File cacheFile = new File(exportsDir, cleanName);
                try (FileOutputStream fos = new FileOutputStream(cacheFile)) {
                    fos.write(bytes);
                    fos.flush();
                }

                boolean savedToDownloads = false;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    try {
                        ContentResolver resolver = getContentResolver();
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.Downloads.DISPLAY_NAME, cleanName);
                        values.put(MediaStore.Downloads.MIME_TYPE, resolvedMime);
                        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                        values.put(MediaStore.Downloads.IS_PENDING, 1);

                        Uri itemUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                        if (itemUri != null) {
                            try (OutputStream os = resolver.openOutputStream(itemUri)) {
                                if (os != null) {
                                    os.write(bytes);
                                    os.flush();
                                }
                            }
                            ContentValues doneValues = new ContentValues();
                            doneValues.put(MediaStore.Downloads.IS_PENDING, 0);
                            resolver.update(itemUri, doneValues, null, null);
                            savedToDownloads = true;
                        }
                    } catch (Exception ignored) {
                        savedToDownloads = false;
                    }
                }

                final Uri contentUri = FileProvider.getUriForFile(
                    MainActivity.this,
                    getPackageName() + ".fileprovider",
                    cacheFile
                );
                final String finalName = cleanName;
                final String finalMime = resolvedMime;
                final boolean finalSaved = savedToDownloads;

                runOnUiThread(() -> {
                    if (finalSaved) {
                        Toast.makeText(
                            MainActivity.this,
                            "Salvat în Descărcări: " + finalName,
                            Toast.LENGTH_LONG
                        ).show();
                    }
                    try {
                        Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                        viewIntent.setDataAndType(contentUri, finalMime);
                        viewIntent.setClipData(ClipData.newRawUri("", contentUri));
                        viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(viewIntent);
                    } catch (ActivityNotFoundException e) {
                        try {
                            Intent shareIntent = new Intent(Intent.ACTION_SEND);
                            shareIntent.setType(finalMime);
                            shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                            shareIntent.putExtra(Intent.EXTRA_SUBJECT, finalName);
                            shareIntent.setClipData(ClipData.newRawUri("", contentUri));
                            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(Intent.createChooser(shareIntent, "Trimite / Salvează " + finalName));
                        } catch (Exception ignored2) {
                            Toast.makeText(
                                MainActivity.this,
                                finalSaved ? ("Salvat în Descărcări: " + finalName) : "Nu s-a putut deschide fișierul.",
                                Toast.LENGTH_LONG
                            ).show();
                        }
                    } catch (Exception e) {
                        if (!finalSaved) {
                            Toast.makeText(
                                MainActivity.this,
                                "Eroare la export: " + e.getMessage(),
                                Toast.LENGTH_LONG
                            ).show();
                        }
                    }
                });
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(
                    MainActivity.this,
                    "Eroare la export: " + e.getMessage(),
                    Toast.LENGTH_LONG
                ).show());
            }
        }
    }
}
