import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { SupportedLanguageCode } from "@/i18n/config";

export function LanguagePreferenceCard() {
  const { language, setLanguage, supported } = useLanguage();
  const { t } = useTranslation();

  const handleChange = async (next: string) => {
    await setLanguage(next as SupportedLanguageCode);
    toast.success("Language updated");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          {t("profile.preferences", "Preferences")}
        </CardTitle>
        <CardDescription>{t("profile.language_help")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2 max-w-sm">
          <Label htmlFor="language">{t("profile.language_preference")}</Label>
          <Select value={language} onValueChange={handleChange}>
            <SelectTrigger id="language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {supported.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  <span className="mr-2">{l.flag}</span>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
