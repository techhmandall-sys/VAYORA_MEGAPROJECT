package com.dypcet.vayora.photo;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.List;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.unit.DataSize;
import org.springframework.web.server.ResponseStatusException;

/**
 * Profile and vehicle photos, kept in PostgreSQL beside the member or vehicle they show.
 *
 * <p>Every upload is decoded and written again as a JPEG no larger than the configured
 * size. That proves it is an image, and it drops everything else the file carried: a phone
 * photo's metadata can include where it was taken. What is stored is only the pixels.
 */
@Service
public class PhotoService {

    public enum Owner {
        USER("user_photos", "user_id"),
        VEHICLE("vehicle_photos", "vehicle_id");

        final String table;
        final String key;

        Owner(String table, String key) {
            this.table = table;
            this.key = key;
        }
    }

    private final JdbcTemplate jdbc;
    private final long maxUploadBytes;
    private final int maxSidePixels;
    private final long maxSourcePixels;

    public PhotoService(JdbcTemplate jdbc,
            @Value("${vayora.photo.max-upload}") DataSize maxUpload,
            @Value("${vayora.photo.max-side-pixels}") int maxSidePixels,
            @Value("${vayora.photo.max-source-pixels}") long maxSourcePixels) {
        this.jdbc = jdbc;
        this.maxUploadBytes = maxUpload.toBytes();
        this.maxSidePixels = maxSidePixels;
        this.maxSourcePixels = maxSourcePixels;
    }

    /** The stored JPEG, or null if there is none. */
    public byte[] get(Owner owner, long id) {
        List<byte[]> found = jdbc.query("SELECT jpeg FROM " + owner.table + " WHERE " + owner.key + " = ?",
                (rs, n) -> rs.getBytes("jpeg"), id);
        return found.isEmpty() ? null : found.get(0);
    }

    /** Replaces the photo. The caller has already checked that this member may. */
    @Transactional
    public void put(Owner owner, long id, byte[] upload) {
        byte[] jpeg = clean(upload);
        jdbc.update("INSERT INTO " + owner.table + " (" + owner.key + ", jpeg, updated_at) VALUES (?, ?, now())"
                + " ON CONFLICT (" + owner.key + ") DO UPDATE SET jpeg = EXCLUDED.jpeg, updated_at = now()",
                id, jpeg);
    }

    @Transactional
    public void remove(Owner owner, long id) {
        jdbc.update("DELETE FROM " + owner.table + " WHERE " + owner.key + " = ?", id);
    }

    /** The upload as a fresh JPEG, scaled down to fit, with nothing but its pixels. */
    byte[] clean(byte[] upload) {
        return encoded(redrawn(upload, maxSidePixels), "jpg");
    }

    /** The same as a PNG, for a picture that must stay exact: a QR code has to scan. */
    public byte[] cleanPng(byte[] upload, int maxSide) {
        return encoded(redrawn(upload, maxSide), "png");
    }

    private BufferedImage redrawn(byte[] upload, int maxSide) {
        if (upload == null || upload.length == 0) {
            throw bad("Choose a photo");
        }
        if (upload.length > maxUploadBytes) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "That photo is too large");
        }
        BufferedImage source = decode(upload);
        double scale = Math.min(1.0, (double) maxSide / Math.max(source.getWidth(), source.getHeight()));
        int width = Math.max(1, (int) Math.round(source.getWidth() * scale));
        int height = Math.max(1, (int) Math.round(source.getHeight() * scale));
        // Neither output keeps transparency: transparent areas become white rather than black.
        BufferedImage out = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setColor(java.awt.Color.WHITE);
            g.fillRect(0, 0, width, height);
            g.drawImage(source, 0, 0, width, height, null);
        } finally {
            g.dispose();
        }
        return out;
    }

    private static byte[] encoded(BufferedImage image, String format) {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try {
            ImageIO.write(image, format, bytes);
        } catch (IOException e) {
            throw new IllegalStateException("Could not write the image as " + format, e);
        }
        return bytes.toByteArray();
    }

    /** Reads the size first, so a small file claiming an enormous picture is refused before decoding. */
    private BufferedImage decode(byte[] upload) {
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(upload))) {
            Iterator<ImageReader> readers = in == null ? null : ImageIO.getImageReaders(in);
            if (readers == null || !readers.hasNext()) {
                throw bad("That is not a photo VAYORA can read: use a JPEG or PNG");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(in, true, true);
                long pixels = (long) reader.getWidth(0) * reader.getHeight(0);
                if (pixels > maxSourcePixels) {
                    throw bad("That photo has too many pixels");
                }
                return reader.read(0);
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            if (e instanceof ResponseStatusException status) {
                throw status;
            }
            throw bad("That is not a photo VAYORA can read: use a JPEG or PNG");
        }
    }

    private static ResponseStatusException bad(String reason) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
    }
}
