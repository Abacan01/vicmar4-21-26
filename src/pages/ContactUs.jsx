import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Phone, Mail, MapPin, Clock } from "lucide-react";

export default function ContactUs() {
  const propertyFromUrl = new URLSearchParams(window.location.search).get("property");

  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    phone: "",
    inquiryType: propertyFromUrl ? "property-inquiry" : "",
    message: propertyFromUrl
      ? `I am interested in the property: ${propertyFromUrl}. Please provide more details.`
      : "",
  });

  const createInquiry = useMutation({
    mutationFn: (data) => base44.entities.Inquiry.create(data),
    onSuccess: () => {
      toast.success("Message sent successfully! We'll contact you soon.");
      setContactForm({ name: "", email: "", phone: "", inquiryType: "", message: "" });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createInquiry.mutate(contactForm);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="relative py-24 px-4"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&q=80')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-[#15803d]/90" />
        <div className="relative max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Contact Us
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Have questions? We're here to help you find your dream home.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Contact Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20">
          {/* Contact Form */}
          <div className="bg-white rounded-xl p-8 shadow-sm">
            <h3 className="text-xl font-bold text-[#16a34a] mb-6">Send Us a Message</h3>
            {propertyFromUrl && (
              <div className="mb-5 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-[#16a34a]">
                <span className="text-green-500 font-bold">✓</span>
                Inquiring about: <span className="font-semibold">{propertyFromUrl}</span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <Select
                value={contactForm.inquiryType}
                onValueChange={(value) => setContactForm({ ...contactForm, inquiryType: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select inquiry type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="property-inquiry">Property Inquiry</SelectItem>
                  <SelectItem value="booking">Site Visit Booking</SelectItem>
                  <SelectItem value="payment">Payment & Financing</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Your Name *"
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                required
              />
              <Input
                type="tel"
                placeholder="Contact Number *"
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                required
              />
              <Input
                type="email"
                placeholder="Email Address *"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                required
              />
              <Textarea
                placeholder="Your Message *"
                value={contactForm.message}
                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                rows={4}
                required
              />
              <Button
                type="submit"
                className="w-full bg-[#16a34a] hover:bg-[#22c55e]"
                disabled={createInquiry.isPending}
              >
                {createInquiry.isPending ? "Sending..." : "Send Message"}
              </Button>
            </form>
          </div>

          {/* Contact Info */}
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#16a34a]/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Phone className="w-6 h-6 text-[#16a34a]" />
                </div>
                <div>
                  <h4 className="font-semibold text-[#16a34a] mb-1">Call Us</h4>
                  <p className="text-gray-600">(043) 233-2050</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#16a34a]/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-[#16a34a]" />
                </div>
                <div>
                  <h4 className="font-semibold text-[#16a34a] mb-1">Visit Our Office</h4>
                  <p className="text-gray-600">San Jose Sico, Batangas City</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#16a34a]/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Mail className="w-6 h-6 text-[#16a34a]" />
                </div>
                <div>
                  <h4 className="font-semibold text-[#16a34a] mb-1">Email Us</h4>
                  <p className="text-gray-600">info@vicmarhomes.com</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#16a34a]/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-[#16a34a]" />
                </div>
                <div>
                  <h4 className="font-semibold text-[#16a34a] mb-1">Office Hours</h4>
                  <p className="text-gray-600">Monday - Friday: 9:00 AM - 5:00 PM</p>
                  <p className="text-gray-600">Saturday: 9:00 AM - 1:00 PM</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
