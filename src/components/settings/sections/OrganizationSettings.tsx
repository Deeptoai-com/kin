/**
 * Organization Settings Component
 *
 * Allows users to create and manage organizations
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useIntlayer } from 'react-intlayer';
import { toLocalizedString } from '~/lib/utils';
import {
  Building2Icon,
  PlusIcon,
  CrownIcon,
  ShieldIcon,
  UserIcon,
  CheckCircle2Icon,
  InfoIcon,
} from 'lucide-react';
import { useServerFn } from '@tanstack/react-start';
import { authClient } from '~/lib/auth-client';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import {
  Alert,
  AlertDescription,
} from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';

export function OrganizationSettings() {
  const content = useIntlayer('settings');

  const organizationSchema = z.object({
    name: z.string().min(1, toLocalizedString(content.organization.nameRequired)),
    slug: z.string().min(1, toLocalizedString(content.organization.slugRequired)).regex(/^[a-z0-9-]+$/, toLocalizedString(content.organization.slugInvalid)),
  });

type OrganizationFormValues = z.infer<typeof organizationSchema>;

  const [organizations, setOrganizations] = React.useState<Array<{
    id: string;
    name: string;
    slug: string | null;
    role: string;
  }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: '',
      slug: '',
    },
  });

  // Load organizations on mount
  React.useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const result = await authClient.organization.list();
      if (result.data) {
        setOrganizations(
          result.data.map((org) => ({
            id: org.id,
            name: org.name,
            slug: org.slug ?? null,
            role: (org as { role?: string }).role ?? 'member',
          })),
        );
      }
    } catch (err) {
      console.error('Failed to load organizations:', err);
      setError(toLocalizedString(content.organization.failedToLoadOrganizations));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: OrganizationFormValues) => {
    setCreating(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await authClient.organization.create({
        name: values.name,
        slug: values.slug,
      });

      if (result.error) {
        setError(result.error.message || toLocalizedString(content.organization.failedToCreateOrganization));
        return;
      }

      setSuccess(true);
      form.reset();

      // Reload organizations list
      await loadOrganizations();
    } catch (err) {
      console.error('Failed to create organization:', err);
      setError(err instanceof Error ? err.message : toLocalizedString(content.organization.failedToCreateOrganization));
    } finally {
      setCreating(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return (
          <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">
            <CrownIcon className="h-3 w-3 mr-1" />
            {content.organization.owner}
          </Badge>
        );
      case 'admin':
        return (
          <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
            <ShieldIcon className="h-3 w-3 mr-1" />
            {content.organization.admin}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <UserIcon className="h-3 w-3 mr-1" />
            {content.organization.member}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Organization Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2Icon className="h-5 w-5" />
            {content.organization.createOrganization}
          </CardTitle>
          <CardDescription>
            {content.organization.createOrgDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Organization Name */}
            <div className="space-y-2">
              <Label htmlFor="name">{content.organization.orgNameLabel}</Label>
              <Input
                id="name"
                placeholder={toLocalizedString(content.organization.orgNamePlaceholder)}
                {...form.register('name')}
                disabled={creating}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
              )}
            </div>

            {/* Organization Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug">{content.organization.slugLabel}</Label>
              <Input
                id="slug"
                placeholder={toLocalizedString(content.organization.slugPlaceholder)}
                {...form.register('slug')}
                disabled={creating}
              />
              {form.formState.errors.slug && (
                <p className="text-sm text-red-500">{form.formState.errors.slug.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {content.organization.slugHelpText}
              </p>
            </div>

            {/* Success Message */}
            {success && (
              <Alert variant="success" className="border-green-200 bg-green-50">
                <CheckCircle2Icon className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  {content.organization.orgCreatedSuccess}
                </AlertDescription>
              </Alert>
            )}

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button type="submit" disabled={creating}>
                {creating ? (
                  <>{content.organization.creating}</>
                ) : (
                  <>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    {content.organization.createOrgButton}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Existing Organizations */}
      <Card>
        <CardHeader>
          <CardTitle>{content.organization.yourOrganizations}</CardTitle>
          <CardDescription>
            {content.organization.yourOrgsDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{content.organization.loading}</p>
          ) : organizations.length === 0 ? (
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                {content.organization.noOrganizations}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {organizations.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{org.name}</h4>
                      {getRoleBadge(org.role)}
                    </div>
                    {org.slug && (
                      <p className="text-xs text-muted-foreground">
                        {toLocalizedString(content.organization.slug).replace('{slug}', org.slug)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Box */}
      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          <strong>{content.organization.orgOwnerBenefits}</strong>
        </AlertDescription>
      </Alert>
    </div>
  );
}
