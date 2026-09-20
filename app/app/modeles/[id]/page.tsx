import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { MessagePreview } from "@/components/templates/MessagePreview";
import { CustomizeTemplateButton, DeleteTemplateButton } from "@/components/templates/TemplateActions";
import { TemplateEditor } from "@/components/templates/TemplateEditor";
import { ToneBadge } from "@/components/templates/ToneBadge";
import { Card, CardContent } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/FormMessage";
import { requireMember } from "@/lib/data/session";
import { getTemplate } from "@/lib/data/templates";
import { CLIENT_TYPE_LABELS } from "@/lib/debtors/client-type";
import { todayInParis } from "@/lib/invoices/dates";
import { renderTemplate } from "@/lib/templates/engine";
import { previewContext } from "@/lib/templates/preview";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const template = await getTemplate((await params).id);
  return { title: template ? template.name : "Modèle introuvable" };
}

export default async function TemplatePage({ params }: PageProps) {
  const [member, template] = await Promise.all([requireMember(), getTemplate((await params).id)]);
  if (!template) notFound();
  const today = todayInParis();
  const organizationName = member.organization.name;
  const listHref = template.clientType === "b2c" ? "/app/modeles?type=particuliers" : "/app/modeles";
  const preview = renderTemplate(template, previewContext(template.clientType, organizationName, today));

  return (
    <>
      <Link
        href={listHref}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors duration-hover hover:text-fg"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Modèles
      </Link>
      <PageHeader
        title={template.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {CLIENT_TYPE_LABELS[template.clientType]} · <ToneBadge tone={template.tone} />
          </span>
        }
        actions={
          template.isSystem ? (
            <CustomizeTemplateButton templateId={template.id} />
          ) : (
            <DeleteTemplateButton templateId={template.id} usageCount={template.usageCount} />
          )
        }
      />
      <Reveal index={1}>
        <Card>
          <CardContent className="flex flex-col gap-5">
            {template.isSystem ? (
              <>
                <FormMessage tone="info">
                  Modèle fourni par Relia, conforme aux règles légales des relances. Pour l&apos;adapter, créez-en une copie
                  personnalisée.
                </FormMessage>
                {preview.ok ? (
                  <MessagePreview from={organizationName} subject={preview.subject} bodyMarkdown={preview.bodyMarkdown} />
                ) : (
                  <FormMessage tone="error">{preview.error}</FormMessage>
                )}
              </>
            ) : (
              <TemplateEditor
                templateId={template.id}
                clientType={template.clientType}
                initial={{ name: template.name, subject: template.subject, bodyMarkdown: template.bodyMarkdown }}
                organizationName={organizationName}
                today={today}
              />
            )}
          </CardContent>
        </Card>
      </Reveal>
    </>
  );
}
