/**
 * cloudinaryService.ts
 *
 * Handles image uploads to Cloudinary via the REST Upload API.
 * Uses axios (already a project dependency) — no Cloudinary SDK needed.
 */

import axios from "axios";
import crypto from "crypto";
import { env } from "../config/env";

const CLOUDINARY_IMAGE_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`;
const CLOUDINARY_RAW_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/raw/upload`;

/**
 * Upload a buffer (file contents) to Cloudinary.
 *
 * @param buffer   Raw file buffer
 * @param folder   Cloudinary folder ("profile-images" | "project-images")
 * @returns        Cloudinary secure URL (auto-optimized)
 */
export async function uploadImageToCloudinary(
  buffer: Buffer,
  folder: string,
): Promise<string> {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary credentials not configured.");
  }

  const timestamp = Math.floor(Date.now() / 1000);

  // Build the signature string (Cloudinary requires sorted params)
  const paramsToSign = [
    `folder=${folder}`,
    `timestamp=${timestamp}`,
    `transformation=f_auto,q_auto,w_800`,
  ].join("&");

  const signature = crypto
    .createHash("sha1")
    .update(paramsToSign + env.CLOUDINARY_API_SECRET)
    .digest("hex");

  // Convert buffer to base64 data URI
  const base64 = `data:image/jpeg;base64,${buffer.toString("base64")}`;

  const formData = {
    file: base64,
    folder,
    timestamp,
    transformation: "f_auto,q_auto,w_800",
    api_key: env.CLOUDINARY_API_KEY,
    signature,
  };

  try {
    const response = await axios.postForm(CLOUDINARY_IMAGE_UPLOAD_URL, formData, {
      maxContentLength: 10 * 1024 * 1024,
      maxBodyLength: 10 * 1024 * 1024,
    });

    if (!response.data?.secure_url) {
      throw new Error("Cloudinary upload failed — no URL returned.");
    }

    return response.data.secure_url as string;
  } catch (error: any) {
    if (error.response?.data) {
      console.error("[Cloudinary Error]:", error.response.data);
    }
    throw error;
  }
}

/**
 * Upload a raw file (e.g. PDF) to Cloudinary.
 *
 * @param buffer   Raw file buffer (PDF)
 * @param folder   Cloudinary folder ("placemates/resumes")
 * @param publicId Optional custom public ID
 * @returns        Cloudinary secure URL
 */
export async function uploadRawToCloudinary(
  buffer: Buffer,
  folder: string,
  publicId?: string,
): Promise<string> {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary credentials not configured.");
  }

  const timestamp = Math.floor(Date.now() / 1000);

  // Build params to sign (must be sorted alphabetically)
  const signParams: Record<string, string> = {
    folder,
    timestamp: String(timestamp),
  };
  if (publicId) {
    signParams.public_id = publicId;
  }

  const paramsToSign = Object.keys(signParams)
    .sort()
    .map((k) => `${k}=${signParams[k]}`)
    .join("&");

  const signature = crypto
    .createHash("sha1")
    .update(paramsToSign + env.CLOUDINARY_API_SECRET)
    .digest("hex");

  // Convert buffer to base64 data URI (PDF)
  const base64 = `data:application/pdf;base64,${buffer.toString("base64")}`;

  const formData: Record<string, any> = {
    file: base64,
    folder,
    timestamp,
    api_key: env.CLOUDINARY_API_KEY,
    signature,
  };
  if (publicId) {
    formData.public_id = publicId;
  }

  try {
    const response = await axios.postForm(CLOUDINARY_RAW_UPLOAD_URL, formData, {
      maxContentLength: 20 * 1024 * 1024,
      maxBodyLength: 20 * 1024 * 1024,
    });

    if (!response.data?.secure_url) {
      throw new Error("Cloudinary raw upload failed — no URL returned.");
    }

    return response.data.secure_url as string;
  } catch (error: any) {
    if (error.response?.data) {
      console.error("[Cloudinary Raw Upload Error]:", error.response.data);
    }
    throw error;
  }
}
