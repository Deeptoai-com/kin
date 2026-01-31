import { createFileRoute } from '@tanstack/react-router';
import { useIntlayer } from 'react-intlayer';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import {
  Check,
  ArrowRight,
  Sparkles,
  Zap,
  Crown,
  Users,
  MessageSquare,
  Headphones,
  Cog,
  Star,
  Shield,
  Rocket,
} from 'lucide-react';
import GradientOrb from '~/components/gradient-orb';

export const Route = createFileRoute('/(marketing)/pricing')({
  component: PricingComponent,
});

function PricingComponent() {
  const content = useIntlayer('marketing');

  const plans = [
    {
      name: content.pricing.plans.free.name,
      price: content.pricing.plans.free.price,
      period: content.pricing.plans.free.period,
      description: content.pricing.plans.free.description,
      badge: null,
      icon: Star,
      features: [
        content.pricing.plans.free.feature1,
        content.pricing.plans.free.feature2,
        content.pricing.plans.free.feature3,
        content.pricing.plans.free.feature4,
        content.pricing.plans.free.feature5,
      ],
      buttonText: content.pricing.plans.free.buttonText,
      buttonVariant: 'outline' as const,
      popular: false,
    },
    {
      name: content.pricing.plans.tier1.name,
      price: content.pricing.plans.tier1.price,
      period: content.pricing.plans.tier1.period,
      description: content.pricing.plans.tier1.description,
      badge: content.pricing.plans.tier1.badge,
      icon: Zap,
      features: [
        content.pricing.plans.tier1.feature1,
        content.pricing.plans.tier1.feature2,
        content.pricing.plans.tier1.feature3,
        content.pricing.plans.tier1.feature4,
        content.pricing.plans.tier1.feature5,
        content.pricing.plans.tier1.feature6,
        content.pricing.plans.tier1.feature7,
      ],
      buttonText: content.pricing.plans.tier1.buttonText,
      buttonVariant: 'default' as const,
      popular: true,
    },
    {
      name: content.pricing.plans.tier2.name,
      price: content.pricing.plans.tier2.price,
      period: content.pricing.plans.tier2.period,
      description: content.pricing.plans.tier2.description,
      badge: content.pricing.plans.tier2.badge,
      icon: Crown,
      features: [
        content.pricing.plans.tier2.feature1,
        content.pricing.plans.tier2.feature2,
        content.pricing.plans.tier2.feature3,
        content.pricing.plans.tier2.feature4,
        content.pricing.plans.tier2.feature5,
        content.pricing.plans.tier2.feature6,
        content.pricing.plans.tier2.feature7,
        content.pricing.plans.tier2.feature8,
      ],
      buttonText: content.pricing.plans.tier2.buttonText,
      buttonVariant: 'outline' as const,
      popular: false,
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Hero Section */}
      <section className="container relative z-0 mx-auto flex flex-col items-center px-4 pt-20 pb-16 text-center md:pt-32 md:pb-24">
        <GradientOrb className="-translate-x-1/2 absolute top-0 left-1/2 z-[-1] transform" />

        <Badge variant="secondary" className="mb-4 px-4 py-1">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          {content.pricing.hero.badge}
        </Badge>

        <h1 className="max-w-4xl font-bold text-4xl text-foreground md:text-6xl lg:text-7xl">
          {content.pricing.hero.title}
          <span className="block text-primary">{content.pricing.hero.titleHighlight}</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
          {content.pricing.hero.subtitle}
        </p>
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="grid gap-8 md:grid-cols-3">
          {plans.map((plan, index) => {
            const IconComponent = plan.icon;
            return (
              <Card
                key={plan.name}
                className={`relative transition-all duration-300 hover:shadow-lg ${
                  plan.popular
                    ? 'border-2 border-primary bg-primary/5 scale-105'
                    : 'border hover:border-primary/50'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1">
                      {plan.badge}
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <div className="flex justify-center mb-4">
                    <div className={`p-3 rounded-full ${
                      plan.popular ? 'bg-primary/20' : 'bg-muted'
                    }`}>
                      <IconComponent className={`h-8 w-8 ${
                        plan.popular ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                    </div>
                  </div>

                  <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>

                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.period && (
                      <span className="text-muted-foreground text-lg">{plan.period}</span>
                    )}
                  </div>

                  <CardDescription className="mt-2 text-base">
                    {plan.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0">
                  <Button
                    className="w-full mb-6 rounded-full"
                    variant={plan.buttonVariant}
                    size="lg"
                  >
                    {plan.buttonText}
                    {plan.buttonVariant === 'default' && (
                      <ArrowRight className="ml-2 h-4 w-4" />
                    )}
                  </Button>

                  <div className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl mb-4">
              {content.pricing.comparison.title}
            </h2>
            <p className="text-lg text-muted-foreground">
              {content.pricing.comparison.subtitle}
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <Users className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>{content.pricing.comparison.communitySupport.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  {content.pricing.comparison.communitySupport.description}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>{content.pricing.plans.free.name}</span>
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex justify-between">
                    <span>{content.pricing.plans.tier1.name}</span>
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex justify-between">
                    <span>{content.pricing.plans.tier2.name}</span>
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <Headphones className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>{content.pricing.comparison.prioritySupport.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  {content.pricing.comparison.prioritySupport.description}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>{content.pricing.plans.free.name}</span>
                    <span className="text-muted-foreground">—</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{content.pricing.plans.tier1.name}</span>
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex justify-between">
                    <span>{content.pricing.plans.tier2.name}</span>
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <Cog className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>{content.pricing.comparison.customIntegrations.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  {content.pricing.comparison.customIntegrations.description}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>{content.pricing.plans.free.name}</span>
                    <span className="text-muted-foreground">—</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{content.pricing.plans.tier1.name}</span>
                    <span className="text-muted-foreground">—</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{content.pricing.plans.tier2.name}</span>
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight md:text-4xl">
            {content.pricing.faq.title}
          </h2>

          <div className="space-y-8">
            <div>
              <h3 className="mb-2 text-xl font-semibold">
                {content.pricing.faq.q1.question}
              </h3>
              <p className="text-muted-foreground">
                {content.pricing.faq.q1.answer}
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-xl font-semibold">
                {content.pricing.faq.q2.question}
              </h3>
              <p className="text-muted-foreground">
                {content.pricing.faq.q2.answer}
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-xl font-semibold">
                {content.pricing.faq.q3.question}
              </h3>
              <p className="text-muted-foreground">
                {content.pricing.faq.q3.answer}
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-xl font-semibold">
                {content.pricing.faq.q4.question}
              </h3>
              <p className="text-muted-foreground">
                {content.pricing.faq.q4.answer}
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-xl font-semibold">
                {content.pricing.faq.q5.question}
              </h3>
              <p className="text-muted-foreground">
                {content.pricing.faq.q5.answer}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <Card className="mx-auto max-w-2xl border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col items-center p-8 text-center md:p-12">
            <Rocket className="mb-4 h-12 w-12 text-primary" />
            <h2 className="mb-4 text-2xl font-bold md:text-3xl">
              {content.pricing.cta.title}
            </h2>
            <p className="mb-8 text-muted-foreground">
              {content.pricing.cta.subtitle}
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Button size="lg" className="rounded-full px-8">
                {content.pricing.cta.primaryButton} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-8">
                <MessageSquare className="mr-2 h-4 w-4" />
                {content.pricing.cta.secondaryButton}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer Trust Signals */}
      <section className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center gap-6 md:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>{content.pricing.trust.security}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Headphones className="h-4 w-4" />
            <span>{content.pricing.trust.support}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{content.pricing.trust.developers}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
