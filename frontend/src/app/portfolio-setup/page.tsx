"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Github, Globe, Linkedin, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setupPortfolio } from "@/lib/api/portfolio-api";

const AVATARS = [
  "/avatars/avatar1.jpg",
  "/avatars/avatar2.jpg",
  "/avatars/avatar3.png",
  "/avatars/avatar4.png",
  "/avatars/avatar5.jpg",
  "/avatars/avatar6.png",
];

export default function PortfolioSetupPage() {
  const router = useRouter();

  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [defaultAvatar, setDefaultAvatar] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [github, setGithub] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [website, setWebsite] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate random avatar AFTER mount to avoid hydration mismatch
  useEffect(() => {
    const randomAvatar =
      AVATARS[Math.floor(Math.random() * AVATARS.length)];
    setDefaultAvatar(randomAvatar);
  }, []);

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhoto(file);

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let photoBase64 = defaultAvatar || undefined;
      if (photo) {
        photoBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(photo);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
        });
      }

      const { slug } = await setupPortfolio({ 
        email, 
        github, 
        linkedin, 
        website,
        photoBase64 
      });
      router.push(`/${slug}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Portfolio Setup</h1>
          <p className="text-muted-foreground">
            Configure your profile details for your generated portfolio.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Profile Photo */}
              <div className="space-y-2">
                <Label>Profile Photo</Label>

                <div className="flex items-center gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border">

                    <Image
                      src={preview ?? defaultAvatar ?? "/avatars/avatar1.jpg"}
                      alt="Profile preview"
                      fill
                      className="object-cover"
                      unoptimized={!!preview}
                    />

                  </div>

                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />

                    <Button type="button" variant="outline" size="sm">
                      <Camera className="mr-2 h-4 w-4" />
                      Upload Photo
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Optional — a random avatar will be used if you skip this.
                </p>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">
                  <Mail className="h-4 w-4" /> Public Contact Email
                </Label>

                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Github */}
              <div className="space-y-2">
                <Label htmlFor="github">
                  <Github className="h-4 w-4" /> GitHub Profile
                </Label>

                <Input
                  id="github"
                  type="url"
                  placeholder="https://github.com/username"
                  value={github}
                  onChange={(e) => setGithub(e.target.value)}
                />
              </div>

              {/* LinkedIn */}
              <div className="space-y-2">
                <Label htmlFor="linkedin">
                  <Linkedin className="h-4 w-4" /> LinkedIn Profile
                </Label>

                <Input
                  id="linkedin"
                  type="url"
                  placeholder="https://linkedin.com/in/username"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                />
              </div>

              {/* Website */}
              <div className="space-y-2">
                <Label htmlFor="website">
                  <Globe className="h-4 w-4" />
                  Personal Website
                  <span className="text-muted-foreground"> (optional)</span>
                </Label>

                <Input
                  id="website"
                  type="url"
                  placeholder="https://yoursite.dev"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              {/* Submit */}
              <Button type="submit" className="w-full" disabled={loading}>
                <Sparkles className="mr-2 h-4 w-4" />
                {loading ? "Generating…" : "Generate Portfolio"}
              </Button>

            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}