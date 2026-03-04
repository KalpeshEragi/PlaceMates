'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, Sparkles, Users, Briefcase, MessageCircle, Play, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export default function LandingPage() {
    const { user, loading } = useAuth()
    const [isScrolled, setIsScrolled] = useState(false)
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20)
        }
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY })
        }

        window.addEventListener('scroll', handleScroll)
        window.addEventListener('mousemove', handleMouseMove)
        return () => {
            window.removeEventListener('scroll', handleScroll)
            window.removeEventListener('mousemove', handleMouseMove)
        }
    }, [])

    const features = [
        {
            title: 'AI Resume Builder',
            description: 'Create professional resumes with AI-powered suggestions that understand your unique strengths and industry standards.',
            icon: Sparkles,
            image: 'https://kimi-web-img.moonshot.cn/img/framerusercontent.com/b223afb4649f98f530757e45013ac219c6ab6a3a.jpeg',
            color: 'from-blue-500/20 to-purple-500/20'
        },
        {
            title: 'Interview Practice',
            description: 'Practice with AI interviewers that simulate real company scenarios and provide personalized feedback.',
            icon: MessageCircle,
            image: 'https://kimi-web-img.moonshot.cn/img/professionalsearchgroup.com.au/5c35d67f6609302500554555623da9e10011b69f.jpg',
            color: 'from-emerald-500/20 to-teal-500/20'
        },
        {
            title: 'College Community',
            description: 'Connect with peers, share experiences, and get insider tips from your campus community.',
            icon: Users,
            image: 'https://kimi-web-img.moonshot.cn/img/as2.ftcdn.net/b12ed86965552fab9a502178bb2979bdd6e7187f.jpg',
            color: 'from-orange-500/20 to-red-500/20'
        },
        // {
        //   title: 'Smart Job Matching',
        //   description: 'Get matched with opportunities that align with your skills, interests, and career aspirations.',
        //   icon: Briefcase,
        //   image: 'https://kimi-web-img.moonshot.cn/img/framery.com/7b13d19c5feb717341300a3ad8b63bb0c8178e52.jpg',
        //   color: 'from-violet-500/20 to-pink-500/20'
        // },
    ]

    const testimonials = [
        {
            quote: "PlaceMate helped me land my dream job at Google. The AI interview practice was a game-changer!",
            author: "Sarah Chen",
            role: "Software Engineer @ Google",
            college: "Stanford University"
        },
        {
            quote: "The resume builder saved me hours of formatting. I got callbacks from 5 companies within a week.",
            author: "Marcus Johnson",
            role: "Product Manager @ Microsoft",
            college: "MIT"
        }
    ]

    return (
        <div className="min-h-screen bg-background overflow-x-hidden">
            {/* Dynamic Background */}
            <div
                className="fixed inset-0 pointer-events-none z-0 opacity-30"
                style={{
                    background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(99, 102, 241, 0.15), transparent 40%)`
                }}
            />

            {/* Navigation */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-lg' : 'bg-transparent'
                }`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
                    <div className="flex items-center gap-3 group cursor-pointer">
                        <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                            P
                            <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <span className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            PlaceMate
                        </span>
                    </div>
                    <div className="flex items-center gap-6">
                        {loading ? (
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        ) : user ? (
                            <Link href="/dashboard">
                                <Button className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-6 shadow-lg hover:shadow-xl transition-all duration-300">
                                    Go to Dashboard
                                </Button>
                            </Link>
                        ) : (
                            <>
                                <Link href="/Authentication" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                                    Sign In
                                </Link>
                                <Link href="/Authentication">
                                    <Button className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-6 shadow-lg hover:shadow-xl transition-all duration-300">
                                        Get Started
                                    </Button>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div className="space-y-8">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
                                <Sparkles className="w-4 h-4" />
                                Trusted by 10,000+ students
                            </div>

                            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
                                Land Your Dream{' '}
                                <span className="relative inline-block">
                                    <span className="relative z-10 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                        Placement
                                    </span>
                                    <svg className="absolute -bottom-2 left-0 w-full h-3 text-indigo-200 -z-0" viewBox="0 0 200 9" fill="none">
                                        <path d="M2.00025 6.99997C25.7501 9.37499 111.525 -3.19999 198.001 6.99997" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                    </svg>
                                </span>
                            </h1>

                            <p className="text-xl text-muted-foreground leading-relaxed max-w-lg">
                                The all-in-one platform designed by students, for students. Build amazing resumes, ace interviews, and connect with your campus community.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <Link href={user ? "/dashboard" : "/Authentication"}>
                                    <Button size="lg" className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-8 h-14 text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group">
                                        {user ? "Go to Dashboard" : "Start Free Today"}
                                        <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                </Link>
                                <Button size="lg" variant="outline" className="rounded-full px-8 h-14 text-lg border-2 hover:bg-muted/50 transition-all duration-300 group">
                                    <Play className="mr-2 w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
                                    Watch Demo
                                </Button>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex -space-x-2">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 border-2 border-background" />
                                    ))}
                                </div>
                                <p>Join 10,000+ students today</p>
                            </div>
                        </div>

                        <div className="relative lg:h-[600px] flex items-center justify-center">
                            <div className="relative w-full max-w-lg aspect-square">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl rotate-6" />
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-3xl -rotate-3" />
                                <img
                                    src="https://img.freepik.com/premium-photo/futuristic-workspace-with-holographic-laptop-display-floating-ui-elements_994764-105251.jpg"
                                    alt="Student working on laptop"
                                    className="relative w-full h-full object-cover rounded-3xl shadow-2xl"
                                />

                                {/* Floating Cards */}
                                <div className="absolute -left-8 top-1/4 bg-white p-4 rounded-2xl shadow-xl animate-bounce delay-700">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold">Resume Scored</p>
                                            <p className="text-xs text-muted-foreground">95/100 ATS Score</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="absolute -right-4 bottom-1/4 bg-white p-4 rounded-2xl shadow-xl animate-bounce delay-1000">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                            <Briefcase className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold">New Match!</p>
                                            <p className="text-xs text-muted-foreground">Google PM Role</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-24 relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
                        <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
                            Everything You Need to{' '}
                            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                Succeed
                            </span>
                        </h2>
                        <p className="text-lg text-muted-foreground">
                            Powerful tools designed specifically for college placements, built with care and attention to detail.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        {features.map((feature, index) => (
                            <Card
                                key={index}
                                className="group relative overflow-hidden border-0 bg-muted/30 hover:bg-muted/50 transition-all duration-500 cursor-pointer"
                            >
                                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                                <div className="relative p-8">
                                    <div className="flex flex-col lg:flex-row gap-6">
                                        <div className="flex-1 space-y-4">
                                            <div className="w-12 h-12 bg-background rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                                                <feature.icon className="w-6 h-6 text-primary" />
                                            </div>
                                            <CardTitle className="text-2xl">{feature.title}</CardTitle>
                                            <CardDescription className="text-base leading-relaxed">
                                                {feature.description}
                                            </CardDescription>
                                            <Link href="/Authentication" className="inline-flex items-center text-sm font-medium text-primary hover:underline">
                                                Learn more <ArrowRight className="ml-1 w-4 h-4" />
                                            </Link>
                                        </div>
                                        <div className="lg:w-48 h-32 lg:h-auto rounded-xl overflow-hidden shadow-lg group-hover:shadow-xl transition-shadow">
                                            <img
                                                src={feature.image}
                                                alt={feature.title}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Social Proof / Stats */}
            <section className="py-20 bg-muted/30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {[
                            { value: '10,000+', label: 'Students Placed', suffix: '' },
                            { value: '500+', label: 'Partner Companies', suffix: '' },
                            { value: '95%', label: 'Success Rate', suffix: '' },
                            { value: '4.9', label: 'User Rating', suffix: '/5' },
                        ].map((stat, index) => (
                            <div key={index} className="text-center space-y-2 group">
                                <div className="text-4xl sm:text-5xl font-bold bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent group-hover:scale-110 transition-transform duration-300">
                                    {stat.value}{stat.suffix}
                                </div>
                                <p className="text-muted-foreground font-medium">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section className="py-24">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl sm:text-4xl font-bold text-center mb-16">Loved by Students</h2>
                    <div className="grid md:grid-cols-2 gap-8">
                        {testimonials.map((testimonial, index) => (
                            <Card key={index} className="border-0 shadow-lg bg-gradient-to-br from-background to-muted/20">
                                <CardContent className="p-8 space-y-4">
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <Sparkles key={star} className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                                        ))}
                                    </div>
                                    <p className="text-lg italic text-foreground/90">"{testimonial.quote}"</p>
                                    <div className="flex items-center gap-4 pt-4">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400" />
                                        <div>
                                            <p className="font-semibold">{testimonial.author}</p>
                                            <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                                            <p className="text-xs text-primary">{testimonial.college}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-700" />
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl" />
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-pink-500 rounded-full blur-3xl" />
                </div>

                <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
                    <h2 className="text-4xl sm:text-5xl font-bold text-white">
                        Ready to Land Your Dream Job?
                    </h2>
                    <p className="text-xl text-white/80 max-w-2xl mx-auto">
                        Join thousands of students who have transformed their career journey with PlaceMate. Your future starts here.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href={user ? "/dashboard" : "/Authentication"}>
                            <Button size="lg" className="bg-white text-indigo-600 hover:bg-white/90 rounded-full px-8 h-14 text-lg shadow-2xl hover:shadow-white/25 transition-all duration-300 hover:-translate-y-1">
                                {user ? "Go to Dashboard" : "Join for Free"}
                            </Button>
                        </Link>
                    </div>
                    <p className="text-sm text-white/60">No credit card required • Free forever plan available</p>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-background border-t border-border pt-16 pb-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
                        <div className="col-span-2 md:col-span-1">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                                    P
                                </div>
                                <span className="text-xl font-bold">PlaceMate</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Empowering students to achieve their career dreams through AI-powered tools and community support.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-4">Product</h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li><Link href="#" className="hover:text-foreground transition-colors">Resume Builder</Link></li>
                                <li><Link href="#" className="hover:text-foreground transition-colors">Interview Prep</Link></li>
                                <li><Link href="#" className="hover:text-foreground transition-colors">Job Matching</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-4">Company</h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li><Link href="#" className="hover:text-foreground transition-colors">About</Link></li>
                                <li><Link href="#" className="hover:text-foreground transition-colors">Blog</Link></li>
                                <li><Link href="#" className="hover:text-foreground transition-colors">Careers</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-4">Support</h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li><Link href="#" className="hover:text-foreground transition-colors">Help Center</Link></li>
                                <li><Link href="#" className="hover:text-foreground transition-colors">Contact</Link></li>
                                <li><Link href="#" className="hover:text-foreground transition-colors">Privacy</Link></li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-sm text-muted-foreground">
                            © 2024 PlaceMate. All rights reserved.
                        </p>
                        <div className="flex gap-6">
                            <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                                Twitter
                            </Link>
                            <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                                LinkedIn
                            </Link>
                            <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                                Instagram
                            </Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    )
}